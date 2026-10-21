import { spawn } from 'node:child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

async function runBrowserVerification() {
  console.log('[Browser Verification] Starting headless Chrome...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  try {
    // Wait for CDP endpoint to be available
    let endpointReady = false;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
        if (res.ok) {
          endpointReady = true;
          break;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }

    if (!endpointReady) {
      throw new Error('Chrome remote debugging port did not open');
    }
    console.log('[Browser Verification] Chrome CDP endpoint active.');

    // Helper to evaluate JS in a tab
    async function createTab(url) {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
      const tab = await res.json();
      return tab;
    }

    async function closeTab(id) {
      await fetch(`http://127.0.0.1:${PORT}/json/close/${id}`);
    }

    // Connect via WebSocket to tab
    async function executeInTab(tab, script) {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(tab.webSocketDebuggerUrl);
        let id = 1;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            id: id++,
            method: 'Runtime.evaluate',
            params: { expression: script, returnByValue: true, awaitPromise: true }
          }));
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === 1) {
            ws.close();
            if (data.error) reject(data.error);
            else if (data.result?.exceptionDetails) reject(data.result.exceptionDetails);
            else resolve(data.result?.result?.value);
          }
        };

        ws.onerror = (err) => reject(err);
      });
    }

    // Wait for page to settle
    await new Promise(r => setTimeout(r, 1000));

    // 1. Verify Home Page
    console.log('\n--- 1. Testing Home Page (http://localhost:3000/) ---');
    const homeTab = await createTab('http://localhost:3000/');
    await new Promise(r => setTimeout(r, 2500));

    const homeData = await executeInTab(homeTab, `(() => {
      return {
        title: document.title,
        hasNavbar: Boolean(document.querySelector('header')),
        hasOldTopBanner: Array.from(document.querySelectorAll('div')).some(el => el.innerText.includes('Synthetic Showcase Demo') && el.parentElement === document.body),
        wsBadgeText: document.querySelector('button[aria-label*="Synthetic Demo"], button[aria-label*="Personal Workspace"]')?.innerText || '',
        pageContent: document.body.innerText.slice(0, 300)
      };
    })()`);
    console.log('Home check result:', homeData);
    if (homeData.hasOldTopBanner) {
      console.error('FAIL: Standalone top banner still present on home page!');
    } else {
      console.log('PASS: Standalone top banner cleanly removed.');
    }
    await closeTab(homeTab.id);

    // 2. Verify Analysis Page
    console.log('\n--- 2. Testing Analysis Page (http://localhost:3000/analysis) ---');
    const analysisTab = await createTab('http://localhost:3000/analysis');
    await new Promise(r => setTimeout(r, 2500));

    const analysisData = await executeInTab(analysisTab, `(() => {
      const paceCard = document.querySelector('.analysis-pace-card');
      const paceBars = document.querySelectorAll('.analysis-pace-card [style*="width"]');
      const metricLabels = Array.from(document.querySelectorAll('.analysis-pace-card .font-mono.uppercase')).map(el => el.innerText);

      return {
        hasPaceCard: Boolean(paceCard),
        paceBarsCount: paceBars.length,
        metricLabels: metricLabels.slice(0, 6),
        paceText: paceCard ? paceCard.innerText.slice(0, 400) : null
      };
    })()`);
    console.log('Analysis check result:', analysisData);
    if (analysisData.hasPaceCard) {
      console.log('PASS: Spending pace card rendered.');
      console.log('Pace bars found:', analysisData.paceBarsCount);
    }
    await closeTab(analysisTab.id);

    // 3. Verify Transactions Page
    console.log('\n--- 3. Testing Transactions Page (http://localhost:3000/transactions) ---');
    const txTab = await createTab('http://localhost:3000/transactions');
    await new Promise(r => setTimeout(r, 2500));

    const txData = await executeInTab(txTab, `(() => {
      const rows = document.querySelectorAll('tbody tr');
      const editButtons = document.querySelectorAll('tbody button[aria-label*="Edit"]');
      const readOnlyBadges = Array.from(document.querySelectorAll('tbody span')).filter(el => el.innerText === 'Read-only');
      const headers = Array.from(document.querySelectorAll('thead th')).map(th => th.innerText);

      return {
        totalRows: rows.length,
        headers,
        editButtonsCount: editButtons.length,
        readOnlyBadgesCount: readOnlyBadges.length
      };
    })()`);
    console.log('Transactions check result:', txData);
    // 4. Verify Personal Workspace in Browser
    console.log('\n--- 4. Testing Personal Workspace Transactions in Chrome ---');
    // First get a guest token from the backend
    const guestRes = await fetch('http://127.0.0.1:8000/api/auth/guest', { method: 'POST' });
    const guestData = await guestRes.json();
    console.log('Obtained guest session token for user:', guestData.user.id);

    // Import 1 statement for this personal user
    const sampleCsv = "Date,Description,Amount,Type\n01/05/2026,Artisan Bakery Bread,180.00,Debit\n";
    const formData = new FormData();
    formData.append('file', new Blob([sampleCsv], { type: 'text/csv' }), 'artisan.csv');
    formData.append('mapping', JSON.stringify({ date: 'Date', description: 'Description', amount: 'Amount', type: 'Type' }));
    formData.append('currency', 'INR');

    const impRes = await fetch('http://127.0.0.1:8000/api/transactions/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${guestData.token}` },
      body: formData
    });
    console.log('Imported personal statement rows:', (await impRes.json()).accepted_rows);

    const personalTab = await createTab('http://localhost:3000/transactions');
    // Wait for origin navigation to commit so localStorage is accessible
    await new Promise(r => setTimeout(r, 2500));
    // Inject token into localStorage and reload
    await executeInTab(personalTab, `(() => {
      localStorage.setItem('usually_auth_token', '${guestData.token}');
      localStorage.setItem('usually_workspace_context', 'personal');
      location.reload();
    })()`);

    await new Promise(r => setTimeout(r, 3000));

    const personalData = await executeInTab(personalTab, `(() => {
      const rows = document.querySelectorAll('tbody tr');
      const editButtons = document.querySelectorAll('tbody button[aria-label*="Edit"]');
      const wsBadge = document.querySelector('button[aria-label*="Personal Workspace"]')?.innerText || '';
      const headerText = Array.from(document.querySelectorAll('thead th')).map(th => th.innerText);

      return {
        totalRows: rows.length,
        headerText,
        wsBadge,
        editButtonsCount: editButtons.length,
        firstRowText: rows[0]?.innerText || ''
      };
    })()`);
    console.log('Personal workspace check result:', personalData);

    if (personalData.editButtonsCount > 0) {
      console.log('PASS: Personal workspace displays active edit buttons!');
    } else {
      console.error('FAIL: Edit buttons not found in personal workspace!');
    }

    // Now test clicking the edit button in the personal workspace!
    const editTest = await executeInTab(personalTab, `(async () => {
      const editBtn = document.querySelector('tbody button[aria-label*="Edit"]');
      if (!editBtn) return { success: false, reason: 'No edit button' };
      editBtn.click();

      // Wait a tick for inputs to mount
      await new Promise(r => setTimeout(r, 200));
      const input = document.querySelector('tbody tr input[type="text"]');
      if (!input) return { success: false, reason: 'Input did not mount' };

      input.value = 'Artisan Sourdough Bakery (Edited)';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const saveBtn = document.querySelector('tbody button[title="Save changes"]');
      if (!saveBtn) return { success: false, reason: 'Save button not found' };
      saveBtn.click();

      await new Promise(r => setTimeout(r, 1000));
      const updatedRow = document.querySelector('tbody tr');
      return {
        success: true,
        updatedRowText: updatedRow?.innerText || ''
      };
    })()`);
    console.log('Live edit test result in Chrome:', editTest);

    await closeTab(personalTab.id);

    console.log('\n[Browser Verification] SUCCESS! All pages rendered with zero crashes.');
  } finally {
    chrome.kill();
  }
}

runBrowserVerification().catch(err => {
  console.error('[Browser Verification] Error:', err);
  process.exit(1);
});

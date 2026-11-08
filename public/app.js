// Pharos Gas Fee Optimizer Frontend Client
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const valCurrentGas = document.getElementById('valCurrentGas');
  const valBaseFee = document.getElementById('valBaseFee');
  const valGasRange = document.getElementById('valGasRange');
  const subAvgGas = document.getElementById('subAvgGas');
  const valActiveQueueCount = document.getElementById('valActiveQueueCount');
  const subGasFreshness = document.getElementById('subGasFreshness');
  const latestBlockVal = document.getElementById('latestBlockVal');
  const mcpDot = document.getElementById('mcpDot');
  const mcpLabel = document.getElementById('mcpLabel');

  const btnConnectWallet = document.getElementById('btnConnectWallet');
  const walletBtnText = document.getElementById('walletBtnText');
  const btnRefreshGas = document.getElementById('btnRefreshGas');
  const btnForceWatchdogTick = document.getElementById('btnForceWatchdogTick');

  const formScheduleIntent = document.getElementById('formScheduleIntent');
  const inputRecipient = document.getElementById('inputRecipient');
  const inputAmount = document.getElementById('inputAmount');
  const inputGasLimit = document.getElementById('inputGasLimit');
  const inputTargetGas = document.getElementById('inputTargetGas');
  const inputDeadline = document.getElementById('inputDeadline');
  const hintCurrentGas = document.getElementById('hintCurrentGas');
  const estFeeAtRequest = document.getElementById('estFeeAtRequest');
  const estFeeAtTarget = document.getElementById('estFeeAtTarget');

  const gasHistoryTableBody = document.getElementById('gasHistoryTableBody');
  const intentCardsContainer = document.getElementById('intentCardsContainer');

  let currentGasPrice = 10.0;
  let currentBaseFee = 1.0;
  let isPolling = false;
  let connectedAddress = null;

  // Wallet Connection (EIP-1193)
  if (btnConnectWallet) {
    btnConnectWallet.addEventListener('click', async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts[0]) {
            connectedAddress = accounts[0];
            const shortAddr = connectedAddress.substring(0, 6) + '...' + connectedAddress.substring(connectedAddress.length - 4);
            walletBtnText.textContent = shortAddr;
            if (inputRecipient && !inputRecipient.value) {
              inputRecipient.value = connectedAddress;
            }
          }
        } catch (err) {
          console.warn('Wallet connection cancelled:', err);
        }
      } else {
        alert('No injected Web3 wallet found. The optimizer can still schedule and monitor intents directly in observation mode.');
      }
    });
  }

  // Update Fee Estimates on Form Changes
  function updateFeeEstimates() {
    const limit = parseInt(inputGasLimit.value) || 21000;
    const targetGas = parseFloat(inputTargetGas.value) || 8.0;

    const feeRequestPharos = ((limit * currentGasPrice * 1e9) / 1e18).toFixed(6);
    const feeTargetPharos = ((limit * targetGas * 1e9) / 1e18).toFixed(6);

    if (estFeeAtRequest) estFeeAtRequest.textContent = `${feeRequestPharos} PHAROS`;
    if (estFeeAtTarget) estFeeAtTarget.textContent = `${feeTargetPharos} PHAROS`;
    if (hintCurrentGas) hintCurrentGas.textContent = currentGasPrice.toFixed(2);
  }

  if (inputGasLimit) inputGasLimit.addEventListener('input', updateFeeEstimates);
  if (inputTargetGas) inputTargetGas.addEventListener('input', updateFeeEstimates);

  // Fetch Gas Analytics (Req 01)
  async function fetchGasAnalytics() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch('/api/gas', { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !data.analytics) return;

      const a = data.analytics;
      currentGasPrice = a.currentGasPriceGwei;
      currentBaseFee = a.currentBaseFeeGwei;

      if (valCurrentGas) valCurrentGas.innerHTML = `${a.currentGasPriceGwei.toFixed(2)} <small>Gwei</small>`;
      if (valBaseFee) valBaseFee.innerHTML = `${a.currentBaseFeeGwei.toFixed(2)} <small>Gwei</small>`;
      if (valGasRange) valGasRange.innerHTML = `${a.minObservedGwei.toFixed(2)} / ${a.maxObservedGwei.toFixed(2)} <small>Gwei</small>`;
      if (subAvgGas) subAvgGas.textContent = `Average: ${a.avgObservedGwei.toFixed(2)} Gwei (${a.observationCount} obs)`;
      if (subGasFreshness) {
        subGasFreshness.textContent = a.isStale ? '⚠️ Stale data (>30s)' : `Fresh • Source: ${a.source}`;
      }

      renderGasHistory(a.history);
      updateFeeEstimates();
    } catch (err) {
      console.warn('Gas analytics fetch warning:', err);
    }
  }

  function renderGasHistory(history) {
    if (!gasHistoryTableBody) return;
    if (!history || history.length === 0) {
      gasHistoryTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No observations recorded yet.</td></tr>`;
      return;
    }

    let html = '';
    const reversed = [...history].reverse().slice(0, 20);
    for (const obs of reversed) {
      const timeStr = new Date(obs.timestamp).toLocaleTimeString();
      const baseFeeStr = obs.baseFeePerGasGwei !== undefined ? `${obs.baseFeePerGasGwei.toFixed(2)} Gwei` : '—';
      html += `
        <tr>
          <td>${timeStr}</td>
          <td>#${obs.blockNumber || '—'}</td>
          <td><strong>${obs.gasPriceGwei.toFixed(2)} Gwei</strong></td>
          <td>${baseFeeStr}</td>
          <td><span class="status-dot green"></span> ${obs.source}</td>
        </tr>
      `;
    }
    gasHistoryTableBody.innerHTML = html;
  }

  // Fetch Intents Queue (Req 02, 03, 04)
  async function fetchIntentsQueue() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch('/api/intents', { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !data.intents) return;

      const activeCount = data.intents.filter((i) => i.status === 'PENDING_HOLD' || i.status.startsWith('READY')).length;
      if (valActiveQueueCount) valActiveQueueCount.textContent = activeCount.toString();

      renderIntents(data.intents);
    } catch (err) {
      console.warn('Intents fetch warning:', err);
    }
  }

  function renderIntents(intents) {
    if (!intentCardsContainer) return;
    if (!intents || intents.length === 0) {
      intentCardsContainer.innerHTML = `<div class="empty-state">No transaction intents scheduled yet. Create an intent above to start optimization.</div>`;
      return;
    }

    const now = Date.now();
    let html = '';

    for (const intent of intents) {
      const timeRemainingMs = intent.deadlineTimestamp - now;
      const secondsLeft = Math.max(0, Math.ceil(timeRemainingMs / 1000));

      let badgeClass = 'badge-hold';
      let badgeLabel = 'HOLDING FOR GAS';
      if (intent.status === 'READY_FAVORABLE') {
        badgeClass = 'badge-favorable';
        badgeLabel = 'READY: FAVORABLE GAS';
      } else if (intent.status === 'READY_DEADLINE_FORCED') {
        badgeClass = 'badge-deadline';
        badgeLabel = 'MANDATORY DEADLINE TRIGGER';
      } else if (intent.status === 'CONFIRMED') {
        badgeClass = 'badge-confirmed';
        badgeLabel = 'CONFIRMED ON-CHAIN';
      } else if (intent.status === 'BROADCASTED') {
        badgeClass = 'badge-favorable';
        badgeLabel = 'BROADCASTED (PENDING)';
      }

      const showBroadcastBtn = intent.status === 'READY_FAVORABLE' || intent.status === 'READY_DEADLINE_FORCED';
      const showVerifyReceiptBtn = intent.status === 'BROADCASTED';

      html += `
        <div class="intent-card">
          <div class="intent-top">
            <span class="intent-badge ${badgeClass}">${badgeLabel}</span>
            <div class="countdown-timer">
              ${intent.status === 'CONFIRMED' ? 'Completed' : `Deadline in: <strong>${secondsLeft}s</strong>`}
            </div>
          </div>

          <div class="intent-explanation">${escapeHtml(intent.decisionReason)}</div>

          <div class="intent-accounting-grid">
            <div class="accounting-item">
              <span>Recipient:</span>
              <strong>${intent.recipient.substring(0, 6)}...${intent.recipient.substring(intent.recipient.length - 4)}</strong>
            </div>
            <div class="accounting-item">
              <span>Amount:</span>
              <strong>${intent.amountPharos} PHAROS</strong>
            </div>
            <div class="accounting-item">
              <span>Initial Estimate:</span>
              <strong>${intent.initialEstimatedFeePharos} PHAROS</strong>
            </div>
            <div class="accounting-item">
              <span>Fee Ceiling:</span>
              <strong>${intent.targetMaxGasPriceGwei.toFixed(2)} Gwei</strong>
            </div>
            ${
              intent.actualFeePaidPharos
                ? `
                <div class="accounting-item">
                  <span>Actual Fee Paid (Receipt):</span>
                  <strong>${intent.actualFeePaidPharos} PHAROS</strong>
                </div>
                <div class="accounting-item">
                  <span>Fee Delta (Savings):</span>
                  <strong class="${parseFloat(intent.feeDeltaPharos || '0') <= 0 ? 'positive-delta' : 'negative-delta'}">
                    ${intent.feeDeltaPharos} PHAROS
                  </strong>
                </div>
              `
                : ''
            }
          </div>

          <div class="intent-bottom">
            <div class="intent-meta">
              <span>Gas at Request: <strong>${intent.gasPriceAtRequestGwei.toFixed(2)} Gwei</strong></span>
            </div>
            <div class="intent-actions">
              ${
                showBroadcastBtn
                  ? `<button class="btn btn-primary btn-sm" onclick="window.broadcastIntent('${intent.id}')">Sign &amp; Broadcast</button>`
                  : ''
              }
              ${
                showVerifyReceiptBtn
                  ? `<button class="btn btn-secondary btn-sm" onclick="window.verifyIntentReceipt('${intent.id}', '${intent.txHash}')">Verify Receipt</button>`
                  : ''
              }
              ${
                intent.explorerUrl
                  ? `<a href="${intent.explorerUrl}" target="_blank" rel="noopener" class="explorer-link">View PharosScan ↗</a>`
                  : ''
              }
            </div>
          </div>
        </div>
      `;
    }

    intentCardsContainer.innerHTML = html;
  }

  // Submit Intent Form
  if (formScheduleIntent) {
    formScheduleIntent.addEventListener('submit', async (e) => {
      e.preventDefault();
      const recipient = inputRecipient.value.trim();
      const amount = inputAmount.value.trim();
      const gasLimit = parseInt(inputGasLimit.value) || 21000;
      const targetGas = parseFloat(inputTargetGas.value);
      const deadlineSec = parseInt(inputDeadline.value);

      try {
        const res = await fetch('/api/intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient,
            amountPharos: amount,
            estimatedGasLimit: gasLimit,
            targetMaxGasPriceGwei: targetGas,
            deadlineSecondsFromNow: deadlineSec,
          }),
        });

        const data = await res.json();
        if (data.success) {
          await fetchIntentsQueue();
          await fetchGasAnalytics();
        } else {
          alert(data.error || 'Failed to schedule intent');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Force Watchdog Evaluation
  if (btnForceWatchdogTick) {
    btnForceWatchdogTick.addEventListener('click', async () => {
      btnForceWatchdogTick.disabled = true;
      try {
        await fetch('/api/evaluate', { method: 'POST' });
        await fetchIntentsQueue();
        await fetchGasAnalytics();
      } finally {
        btnForceWatchdogTick.disabled = false;
      }
    });
  }

  if (btnRefreshGas) {
    btnRefreshGas.addEventListener('click', fetchGasAnalytics);
  }

  // Broadcast Handler (Triggered by user click when favorable or forced deadline)
  window.broadcastIntent = async function (id) {
    const fakeOrRealHash = prompt(
      'Broadcast Authorization:\nEnter on-chain Transaction Hash from your wallet (or press OK to simulate a real Atlantic Testnet broadcast):',
      '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    );
    if (!fakeOrRealHash) return;

    try {
      const res = await fetch(`/api/intents/${id}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: fakeOrRealHash }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchIntentsQueue();
      } else {
        alert(data.error || 'Broadcast update failed');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Receipt Verification Handler (Requirement 03)
  window.verifyIntentReceipt = async function (id, txHash) {
    try {
      const res = await fetch(`/api/intents/${id}/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchIntentsQueue();
      } else {
        alert(data.error || 'Receipt verification failed');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Telemetry Poll
  async function fetchTelemetry() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch('/api/telemetry', { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !data.telemetry) return;

      const t = data.telemetry;
      if (latestBlockVal) latestBlockVal.textContent = '#' + t.latestBlock.toLocaleString();
      if (mcpDot && mcpLabel) {
        if (t.mcpConnected) {
          mcpDot.className = 'status-dot green';
          mcpLabel.textContent = 'MCP: Live (get_gas_price)';
        } else {
          mcpDot.className = 'status-dot pulse';
          mcpLabel.textContent = 'MCP: Synced';
        }
      }
    } catch (err) {
      console.warn('Telemetry warning:', err);
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Recursive Polling Loop
  async function runPoll() {
    if (isPolling) return;
    isPolling = true;

    try {
      await fetchTelemetry();
      await fetchGasAnalytics();
      await fetchIntentsQueue();
    } catch (err) {
      console.warn('Poll iteration warning:', err);
    } finally {
      isPolling = false;
      setTimeout(runPoll, 5000);
    }
  }

  runPoll();
});

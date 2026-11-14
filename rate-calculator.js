/**
 * Creative Souls 3D - 3D Printing Rate & Cost Calculator
 * Comprehensive estimation engine supporting Anycubic Kobra 2 Neo (₹16,000),
 * Anycubic Kobra X (₹40,000), and custom printers.
 * Provides both Beginner Mode (quick quote) & Complex Mode (engineering precision).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RateCalculator = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ── 1. HARDWARE & MACHINE PRESETS ────────────────────────────────
  const PRINTER_PRESETS = {
    kobra2neo: {
      id: 'kobra2neo',
      name: 'Anycubic Kobra 2 Neo',
      shortName: 'Kobra 2 Neo',
      cost: 16000,
      powerWatts: 180,
      lifespanHours: 3000,
      defaultDepreciationRate: 16000 / 3000, // ₹5.33 / hr
      defaultMaintenanceRate: 6.00, // ₹6.00 / hr (nozzles, belts, wheels, grease)
      bedSize: '220 × 220 × 250 mm',
      speed: 'Up to 250 mm/s',
      badge: 'High-Speed Bed-slinger',
      description: 'Compact, 250mm/s rapid bed-slinger. Low power consumption & low hourly overhead.'
    },
    kobrax: {
      id: 'kobrax',
      name: 'Anycubic Kobra X',
      shortName: 'Kobra X',
      cost: 40000,
      powerWatts: 350,
      lifespanHours: 4000,
      defaultDepreciationRate: 40000 / 4000, // ₹10.00 / hr
      defaultMaintenanceRate: 12.00, // ₹12.00 / hr (heavy-duty PEI, linear rails, large heater)
      bedSize: 'Large Format',
      speed: 'High Throughput',
      badge: 'Heavy-Duty / Large Format',
      description: 'Production-grade workhorse with high wattage bed heater and reinforced mechanical rails.'
    },
    custom: {
      id: 'custom',
      name: 'Custom 3D Printer',
      shortName: 'Custom Printer',
      cost: 25000,
      powerWatts: 250,
      lifespanHours: 3500,
      defaultDepreciationRate: 25000 / 3500, // ~₹7.14 / hr
      defaultMaintenanceRate: 8.00,
      bedSize: 'Custom Build Volume',
      speed: 'Configurable',
      badge: 'Custom Machine',
      description: 'Enter your custom machine price, expected lifespan, power draw, and maintenance cost.'
    }
  };

  // ── 2. FILAMENT & MATERIAL PRESETS ──────────────────────────────
  const FILAMENT_PRESETS = {
    pla_std: {
      id: 'pla_std',
      name: 'PLA Standard',
      category: 'General',
      spoolPrice: 850,
      spoolGrams: 1000,
      density: 1.24,
      description: 'Everyday standard PLA. Clean finish, easy to print, great for display items.'
    },
    pla_plus: {
      id: 'pla_plus',
      name: 'PLA+ / Tough High-Speed',
      category: 'General',
      spoolPrice: 1050,
      spoolGrams: 1000,
      density: 1.25,
      description: 'Reinforced impact strength and superior layer adhesion.'
    },
    petg: {
      id: 'petg',
      name: 'PETG Functional',
      category: 'Engineering',
      spoolPrice: 950,
      spoolGrams: 1000,
      density: 1.27,
      description: 'UV & temperature resistant, flexible and chemical-tolerant.'
    },
    abs: {
      id: 'abs',
      name: 'ABS / ASA Technical',
      category: 'Engineering',
      spoolPrice: 1150,
      spoolGrams: 1000,
      density: 1.05,
      description: 'High heat tolerance up to 90°C, acetone-smoothable.'
    },
    tpu: {
      id: 'tpu',
      name: 'TPU 95A Flexible',
      category: 'Specialty',
      spoolPrice: 1450,
      spoolGrams: 1000,
      density: 1.21,
      description: 'Rubber-like flexibility, impact dampening, vibration proof.'
    },
    silk: {
      id: 'silk',
      name: 'Silk / Dual-Tone PLA',
      category: 'Aesthetic',
      spoolPrice: 1250,
      spoolGrams: 1000,
      density: 1.24,
      description: 'Shimmering metallic sheen, ideal for vases and artistic sculptures.'
    },
    cf: {
      id: 'cf',
      name: 'Carbon Fiber PLA-CF',
      category: 'Specialty',
      spoolPrice: 1850,
      spoolGrams: 1000,
      density: 1.30,
      description: 'Ultra-stiff, matte finish with carbon micro-fibers. High rigidity.'
    },
    custom: {
      id: 'custom',
      name: 'Custom Filament',
      category: 'Custom',
      spoolPrice: 900,
      spoolGrams: 1000,
      density: 1.25,
      description: 'User-specified spool weight and price.'
    }
  };

  // ── 3. DEFAULT STATE ─────────────────────────────────────────────
  const DEFAULT_STATE = {
    mode: 'beginner', // 'beginner' | 'complex'
    printerId: 'kobra2neo',
    printerName: PRINTER_PRESETS.kobra2neo.name,
    printerCost: 16000,
    lifespanHours: 3000,
    hourlyDepreciation: Number((16000 / 3000).toFixed(2)),
    hourlyMaintenance: 6.00,
    powerWatts: 180,
    electricityRatePerKwh: 9.00,

    // Time & Weight
    hours: 3,
    minutes: 45,
    weightGrams: 65,

    // Material
    filamentKey: 'pla_std',
    filamentName: 'PLA Standard',
    spoolPrice: 850,
    spoolGrams: 1000,
    wastePercent: 5, // beginner default 5%

    // Labor & Handling (Complex mode)
    prepMinutes: 10,
    postMinutes: 15,
    laborRatePerHour: 120,
    hardwareCost: 0,
    packagingCost: 20,

    // Commercial & Overheads (Complex mode)
    failurePercent: 8,
    overheadRatePerHour: 15,
    pricingMethod: 'markup', // 'markup' (% on cost) | 'margin' (% of selling price)
    markupPercent: 50, // default 50%
    taxPercent: 0,
    quantity: 1,
    wholesaleDiscountPercent: 15,

    // Client Quotation Metadata
    productName: 'Custom 3D Print',
    customerName: '',
    clientNotes: 'Layer height: 0.2mm, Infill: 20% Gyroid',
    turnaroundDays: '1-2 business days'
  };

  // ── 4. CALCULATION ENGINE ────────────────────────────────────────
  function calculateRate(state = DEFAULT_STATE) {
    const s = Object.assign({}, DEFAULT_STATE, state);

    // 1. Time Calculation
    const hours = Math.max(0, Number(s.hours) || 0);
    const minutes = Math.max(0, Math.min(59, Number(s.minutes) || 0));
    const totalPrintHours = hours + (minutes / 60);

    // 2. Filament Material Cost
    const spoolPrice = Math.max(0, Number(s.spoolPrice) || 0);
    const spoolGrams = Math.max(1, Number(s.spoolGrams) || 1000);
    const costPerGram = spoolPrice / spoolGrams;
    const netWeightGrams = Math.max(0, Number(s.weightGrams) || 0);

    // In beginner mode, waste is 5%; in complex mode, uses customizable wastePercent
    const wastePercent = s.mode === 'beginner' ? 5 : Math.max(0, Number(s.wastePercent) || 0);
    const grossWeightGrams = netWeightGrams * (1 + (wastePercent / 100));
    const materialCost = grossWeightGrams * costPerGram;

    // 3. Machine Depreciation Cost
    const printerCost = Math.max(0, Number(s.printerCost) || 0);
    const lifespanHours = Math.max(100, Number(s.lifespanHours) || 3000);
    const calculatedHourlyDepr = printerCost / lifespanHours;
    // Allow override if explicitly given, otherwise use calculated rate
    const hourlyDepreciation = Number(s.hourlyDepreciation) > 0 ? Number(s.hourlyDepreciation) : calculatedHourlyDepr;
    const depreciationCost = hourlyDepreciation * totalPrintHours;

    // 4. Machine Maintenance Cost
    const hourlyMaintenance = Math.max(0, Number(s.hourlyMaintenance) || 0);
    const maintenanceCost = hourlyMaintenance * totalPrintHours;

    // 5. Electricity / Power Cost
    const powerWatts = Math.max(0, Number(s.powerWatts) || 0);
    const electricityRatePerKwh = Math.max(0, Number(s.electricityRatePerKwh) || 0);
    const powerKwh = (powerWatts / 1000) * totalPrintHours;
    const powerCost = powerKwh * electricityRatePerKwh;

    // Machine subtotal (Run cost)
    const machineRunCost = depreciationCost + maintenanceCost + powerCost;

    // 6. Mode-Specific Elements (Labor, Hardware, Overheads, Failure)
    let failureCost = 0;
    let prepCost = 0;
    let postCost = 0;
    let laborCost = 0;
    let hardwareCost = 0;
    let packagingCost = 0;
    let overheadCost = 0;
    let unitProductionCost = 0;

    if (s.mode === 'beginner') {
      // Beginner Mode: Streamlined, automatic 5% failure buffer
      const baseDirect = materialCost + machineRunCost;
      failureCost = baseDirect * 0.05;
      unitProductionCost = baseDirect + failureCost;
    } else {
      // Complex Mode: Granular engineering costs
      const failurePercent = Math.max(0, Number(s.failurePercent) || 0);
      const directMachineAndMaterial = materialCost + machineRunCost;
      failureCost = directMachineAndMaterial * (failurePercent / 100);

      const prepMinutes = Math.max(0, Number(s.prepMinutes) || 0);
      const postMinutes = Math.max(0, Number(s.postMinutes) || 0);
      const laborRatePerHour = Math.max(0, Number(s.laborRatePerHour) || 0);
      prepCost = (prepMinutes / 60) * laborRatePerHour;
      postCost = (postMinutes / 60) * laborRatePerHour;
      laborCost = prepCost + postCost;

      hardwareCost = Math.max(0, Number(s.hardwareCost) || 0);
      packagingCost = Math.max(0, Number(s.packagingCost) || 0);

      const overheadRatePerHour = Math.max(0, Number(s.overheadRatePerHour) || 0);
      overheadCost = overheadRatePerHour * totalPrintHours;

      unitProductionCost = directMachineAndMaterial + failureCost + laborCost + hardwareCost + packagingCost + overheadCost;
    }

    // 7. Markup & Selling Price
    const markupPercent = Math.max(0, Number(s.markupPercent) || 0);
    const pricingMethod = s.pricingMethod || 'markup';

    let sellingPriceBeforeTax = 0;
    let unitProfit = 0;

    if (pricingMethod === 'margin') {
      // Gross Profit Margin formula: Price = Cost / (1 - Margin%)
      const marginRatio = Math.min(0.99, markupPercent / 100);
      sellingPriceBeforeTax = unitProductionCost / Math.max(0.01, (1 - marginRatio));
      unitProfit = sellingPriceBeforeTax - unitProductionCost;
    } else {
      // Markup on Cost formula: Price = Cost * (1 + Markup%)
      unitProfit = unitProductionCost * (markupPercent / 100);
      sellingPriceBeforeTax = unitProductionCost + unitProfit;
    }

    // 8. Tax / GST
    const taxPercent = s.mode === 'beginner' ? 0 : Math.max(0, Number(s.taxPercent) || 0);
    const taxAmount = sellingPriceBeforeTax * (taxPercent / 100);
    const finalUnitPrice = Math.round(sellingPriceBeforeTax + taxAmount);

    // 9. Wholesale / Bulk Tier
    const wholesaleDiscountPercent = s.mode === 'beginner' ? 15 : Math.max(0, Number(s.wholesaleDiscountPercent) || 0);
    const wholesaleUnitPrice = Math.round(sellingPriceBeforeTax * (1 - (wholesaleDiscountPercent / 100)));

    // 10. Multi-Quantity Batch Totals
    const quantity = Math.max(1, parseInt(s.quantity, 10) || 1);
    const batchTotalCost = unitProductionCost * quantity;
    const batchTotalRevenue = finalUnitPrice * quantity;
    const batchTotalProfit = (finalUnitPrice - unitProductionCost) * quantity;

    // 11. Efficiency & Margins
    const effectiveMarginPercent = finalUnitPrice > 0
      ? Number((((finalUnitPrice - unitProductionCost) / finalUnitPrice) * 100).toFixed(1))
      : 0;

    const hourlyEarnings = totalPrintHours > 0
      ? Number((unitProfit / totalPrintHours).toFixed(2))
      : 0;

    // 12. Visual Distribution Percentages (for cost breakdown bar)
    const totalForBar = Math.max(0.01, finalUnitPrice);
    const breakdownShares = {
      material: Number(((materialCost / totalForBar) * 100).toFixed(1)),
      depreciation: Number(((depreciationCost / totalForBar) * 100).toFixed(1)),
      maintenance: Number(((maintenanceCost / totalForBar) * 100).toFixed(1)),
      power: Number(((powerCost / totalForBar) * 100).toFixed(1)),
      labor: Number(((laborCost / totalForBar) * 100).toFixed(1)),
      overheadsAndBuffer: Number((((failureCost + hardwareCost + packagingCost + overheadCost) / totalForBar) * 100).toFixed(1)),
      profit: Number(((unitProfit / totalForBar) * 100).toFixed(1)),
      tax: Number(((taxAmount / totalForBar) * 100).toFixed(1))
    };

    return {
      // Inputs echo
      mode: s.mode,
      printerId: s.printerId,
      totalPrintHours: Number(totalPrintHours.toFixed(2)),
      formattedTime: `${hours}h ${minutes}m`,
      costPerGram: Number(costPerGram.toFixed(3)),
      grossWeightGrams: Number(grossWeightGrams.toFixed(1)),
      netWeightGrams,

      // Component Costs
      materialCost: Number(materialCost.toFixed(2)),
      depreciationCost: Number(depreciationCost.toFixed(2)),
      hourlyDepreciation: Number(hourlyDepreciation.toFixed(2)),
      maintenanceCost: Number(maintenanceCost.toFixed(2)),
      hourlyMaintenance: Number(hourlyMaintenance.toFixed(2)),
      powerCost: Number(powerCost.toFixed(2)),
      powerKwh: Number(powerKwh.toFixed(3)),
      machineRunCost: Number(machineRunCost.toFixed(2)),
      failureCost: Number(failureCost.toFixed(2)),

      // Complex specifics
      laborCost: Number(laborCost.toFixed(2)),
      prepCost: Number(prepCost.toFixed(2)),
      postCost: Number(postCost.toFixed(2)),
      hardwareCost: Number(hardwareCost.toFixed(2)),
      packagingCost: Number(packagingCost.toFixed(2)),
      overheadCost: Number(overheadCost.toFixed(2)),

      // Totals & Prices
      unitProductionCost: Number(unitProductionCost.toFixed(2)),
      unitProfit: Number(unitProfit.toFixed(2)),
      sellingPriceBeforeTax: Number(sellingPriceBeforeTax.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      finalUnitPrice,
      wholesaleUnitPrice,

      // Batch
      quantity,
      batchTotalCost: Number(batchTotalCost.toFixed(2)),
      batchTotalRevenue: Number(batchTotalRevenue.toFixed(2)),
      batchTotalProfit: Number(batchTotalProfit.toFixed(2)),

      // Metrics
      effectiveMarginPercent,
      hourlyEarnings,
      breakdownShares
    };
  }

  // ── 5. PROFESSIONAL QUOTATION GENERATOR ──────────────────────────
  function generateQuotationText(state, results) {
    const printer = PRINTER_PRESETS[state.printerId] || PRINTER_PRESETS.kobra2neo;
    const filament = FILAMENT_PRESETS[state.filamentKey] || { name: state.filamentName || '3D Printing Filament' };
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    return `✨ *Creative Souls 3D — Custom 3D Printing Quotation* ✨
--------------------------------------------------
📅 *Date:* ${dateStr}
📦 *Product / Job:* ${state.productName || 'Custom 3D Print'}
${state.customerName ? `👤 *Client:* ${state.customerName}\n` : ''}--------------------------------------------------
🖨️ *Printer:* ${printer.name}
🧵 *Filament:* ${filament.name}
⚖️ *Estimated Weight:* ~${state.weightGrams}g net
⏱️ *Print Duration:* ${results.formattedTime}
${state.quantity > 1 ? `🔢 *Quantity:* ${state.quantity} unit(s)\n` : ''}--------------------------------------------------
💰 *Total Quotation:* ₹${state.quantity > 1 ? results.batchTotalRevenue : results.finalUnitPrice} ${state.taxPercent > 0 ? `(Incl. ${state.taxPercent}% GST)` : '(Net)'}
${state.quantity > 1 ? `🏷️ *Unit Rate:* ₹${results.finalUnitPrice}/unit\n` : ''}🚚 *Turnaround:* ${state.turnaroundDays || '1-2 business days'}
✨ *Includes:* High-resolution slicing, support cleanup, precision QA & protective packaging.
--------------------------------------------------
To confirm your print order or discuss custom finish options, simply reply to this message! 🚀`;
  }

  // ── 6. UI CONTROLLER & DOM INTEGRATION ───────────────────────────
  let appState = Object.assign({}, DEFAULT_STATE);
  let isInitialized = false;

  function initUI() {
    if (isInitialized) return;
    isInitialized = true;

    // Load saved custom presets from localStorage if available
    loadStoredSettings();

    // Bind all inputs and interactive elements
    bindUIEvents();

    // Perform initial calculation and render
    updateAll();
  }

  function loadStoredSettings() {
    try {
      const saved = localStorage.getItem('cs3d_rate_calc_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        appState = Object.assign({}, DEFAULT_STATE, parsed);
      }
    } catch (e) {
      console.warn('Could not load saved Rate Calculator state:', e);
    }
  }

  function saveCurrentSettings() {
    try {
      localStorage.setItem('cs3d_rate_calc_state', JSON.stringify(appState));
    } catch (e) {
      console.warn('Could not save Rate Calculator state:', e);
    }
  }

  function switchMode(newMode) {
    appState.mode = newMode === 'complex' ? 'complex' : 'beginner';

    // Update active tab buttons
    document.querySelectorAll('.calc-mode-btn').forEach(btn => {
      const isActive = btn.dataset.mode === appState.mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    // Toggle view visibility
    const beginnerView = document.getElementById('calc-beginner-view');
    const complexView = document.getElementById('calc-complex-view');

    if (beginnerView && complexView) {
      if (appState.mode === 'beginner') {
        beginnerView.hidden = false;
        complexView.hidden = true;
      } else {
        beginnerView.hidden = true;
        complexView.hidden = false;
      }
    }

    saveCurrentSettings();
    updateAll();
  }

  function selectPrinter(printerId) {
    if (!PRINTER_PRESETS[printerId]) printerId = 'kobra2neo';
    const preset = PRINTER_PRESETS[printerId];

    appState.printerId = printerId;
    appState.printerName = preset.name;
    appState.printerCost = preset.cost;
    appState.lifespanHours = preset.lifespanHours;
    appState.hourlyDepreciation = Number((preset.cost / preset.lifespanHours).toFixed(2));
    appState.hourlyMaintenance = preset.defaultMaintenanceRate;
    appState.powerWatts = preset.powerWatts;

    // Sync input fields in both views
    syncPrinterInputs();
    saveCurrentSettings();
    updateAll();
  }

  function syncPrinterInputs() {
    // Beginner Printer Radio Cards
    document.querySelectorAll('.calc-printer-card').forEach(card => {
      const match = card.dataset.printerId === appState.printerId;
      card.classList.toggle('selected', match);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = match;
    });

    // Complex Printer Select
    const compSelect = document.getElementById('calc-c-printer');
    if (compSelect) compSelect.value = appState.printerId;

    // Complex machine parameters fields
    const costInput = document.getElementById('calc-c-machine-cost');
    if (costInput) costInput.value = appState.printerCost;

    const lifespanInput = document.getElementById('calc-c-lifespan');
    if (lifespanInput) lifespanInput.value = appState.lifespanHours;

    const deprInput = document.getElementById('calc-c-depr-rate');
    if (deprInput) deprInput.value = appState.hourlyDepreciation;

    const maintInput = document.getElementById('calc-c-maint-rate');
    if (maintInput) maintInput.value = appState.hourlyMaintenance;

    const wattsInput = document.getElementById('calc-c-watts');
    if (wattsInput) wattsInput.value = appState.powerWatts;
  }

  function selectFilament(filamentKey) {
    if (!FILAMENT_PRESETS[filamentKey]) filamentKey = 'pla_std';
    const preset = FILAMENT_PRESETS[filamentKey];

    appState.filamentKey = filamentKey;
    appState.filamentName = preset.name;
    appState.spoolPrice = preset.spoolPrice;
    appState.spoolGrams = preset.spoolGrams;

    // Sync filament selectors & spool price inputs
    const bFilament = document.getElementById('calc-b-filament');
    if (bFilament) bFilament.value = filamentKey;

    const cFilament = document.getElementById('calc-c-filament');
    if (cFilament) cFilament.value = filamentKey;

    const bSpoolPrice = document.getElementById('calc-b-spool-price');
    if (bSpoolPrice) bSpoolPrice.value = preset.spoolPrice;

    const cSpoolPrice = document.getElementById('calc-c-spool-price');
    if (cSpoolPrice) cSpoolPrice.value = preset.spoolPrice;

    saveCurrentSettings();
    updateAll();
  }

  function bindUIEvents() {
    // 1. Mode switchers
    document.querySelectorAll('.calc-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    // 2. Beginner Printer Cards
    document.querySelectorAll('.calc-printer-card').forEach(card => {
      card.addEventListener('click', () => {
        selectPrinter(card.dataset.printerId);
      });
    });

    // 3. Complex Printer Select
    const compSelect = document.getElementById('calc-c-printer');
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        selectPrinter(e.target.value);
      });
    }

    // 4. Filament Selectors
    const bFilament = document.getElementById('calc-b-filament');
    if (bFilament) {
      bFilament.addEventListener('change', (e) => selectFilament(e.target.value));
    }
    const cFilament = document.getElementById('calc-c-filament');
    if (cFilament) {
      cFilament.addEventListener('change', (e) => selectFilament(e.target.value));
    }

    // 5. Beginner Inputs
    bindNumberInput('calc-b-hours', 'hours', true);
    bindNumberInput('calc-b-minutes', 'minutes', true);
    bindNumberInput('calc-b-weight', 'weightGrams', true);
    bindNumberInput('calc-b-spool-price', 'spoolPrice', true);

    // Beginner Markup Chips
    document.querySelectorAll('.calc-markup-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const val = Number(chip.dataset.markup) || 50;
        appState.markupPercent = val;
        document.querySelectorAll('.calc-markup-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const customInput = document.getElementById('calc-b-markup-custom');
        if (customInput) customInput.value = val;
        const cMarkupInput = document.getElementById('calc-c-markup');
        if (cMarkupInput) cMarkupInput.value = val;
        saveCurrentSettings();
        updateAll();
      });
    });

    const bCustomMarkup = document.getElementById('calc-b-markup-custom');
    if (bCustomMarkup) {
      bCustomMarkup.addEventListener('input', (e) => {
        appState.markupPercent = Number(e.target.value) || 0;
        document.querySelectorAll('.calc-markup-chip').forEach(c => {
          c.classList.toggle('active', Number(c.dataset.markup) === appState.markupPercent);
        });
        const cMarkupInput = document.getElementById('calc-c-markup');
        if (cMarkupInput) cMarkupInput.value = appState.markupPercent;
        saveCurrentSettings();
        updateAll();
      });
    }

    // 6. Complex Inputs
    bindNumberInput('calc-c-hours', 'hours', true);
    bindNumberInput('calc-c-minutes', 'minutes', true);
    bindNumberInput('calc-c-weight', 'weightGrams', true);
    bindNumberInput('calc-c-spool-price', 'spoolPrice', true);
    bindNumberInput('calc-c-spool-grams', 'spoolGrams', false);
    bindNumberInput('calc-c-waste', 'wastePercent', false);

    bindNumberInput('calc-c-machine-cost', 'printerCost', false, () => {
      // Recalculate depreciation rate
      const cost = Math.max(0, Number(appState.printerCost) || 0);
      const life = Math.max(100, Number(appState.lifespanHours) || 3000);
      appState.hourlyDepreciation = Number((cost / life).toFixed(2));
      const deprInput = document.getElementById('calc-c-depr-rate');
      if (deprInput) deprInput.value = appState.hourlyDepreciation;
    });

    bindNumberInput('calc-c-lifespan', 'lifespanHours', false, () => {
      const cost = Math.max(0, Number(appState.printerCost) || 0);
      const life = Math.max(100, Number(appState.lifespanHours) || 3000);
      appState.hourlyDepreciation = Number((cost / life).toFixed(2));
      const deprInput = document.getElementById('calc-c-depr-rate');
      if (deprInput) deprInput.value = appState.hourlyDepreciation;
    });

    bindNumberInput('calc-c-depr-rate', 'hourlyDepreciation', false);
    bindNumberInput('calc-c-maint-rate', 'hourlyMaintenance', false);
    bindNumberInput('calc-c-watts', 'powerWatts', false);
    bindNumberInput('calc-c-power-rate', 'electricityRatePerKwh', false);

    bindNumberInput('calc-c-prep-mins', 'prepMinutes', false);
    bindNumberInput('calc-c-post-mins', 'postMinutes', false);
    bindNumberInput('calc-c-labor-rate', 'laborRatePerHour', false);
    bindNumberInput('calc-c-hardware', 'hardwareCost', false);
    bindNumberInput('calc-c-packaging', 'packagingCost', false);

    bindNumberInput('calc-c-failure', 'failurePercent', false);
    bindNumberInput('calc-c-overhead', 'overheadRatePerHour', false);
    bindNumberInput('calc-c-markup', 'markupPercent', true);
    bindNumberInput('calc-c-tax', 'taxPercent', false);
    bindNumberInput('calc-c-qty', 'quantity', false);
    bindNumberInput('calc-c-wholesale', 'wholesaleDiscountPercent', false);

    // Complex Pricing Strategy Select (Markup vs Margin)
    const strategySelect = document.getElementById('calc-c-strategy');
    if (strategySelect) {
      strategySelect.addEventListener('change', (e) => {
        appState.pricingMethod = e.target.value;
        saveCurrentSettings();
        updateAll();
      });
    }

    // Client Quote Meta
    bindTextInput('calc-quote-product', 'productName');
    bindTextInput('calc-quote-customer', 'customerName');
    bindTextInput('calc-quote-turnaround', 'turnaroundDays');

    // 7. Actions: Copy Quote, Print, Reset, Save Preset
    const copyBtn = document.getElementById('calc-copy-quote-btn');
    if (copyBtn) copyBtn.addEventListener('click', copyQuotationToClipboard);

    const printBtn = document.getElementById('calc-print-quote-btn');
    if (printBtn) printBtn.addEventListener('click', printQuotationSlip);

    const resetBtn = document.getElementById('calc-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetToDefaults);

    const savePresetBtn = document.getElementById('calc-save-preset-btn');
    if (savePresetBtn) savePresetBtn.addEventListener('click', promptSavePreset);

    const loadPresetSelect = document.getElementById('calc-preset-select');
    if (loadPresetSelect) loadPresetSelect.addEventListener('change', (e) => loadNamedPreset(e.target.value));

    // Send price to catalog product editor
    const applyToCatalogBtn = document.getElementById('calc-apply-to-catalog-btn');
    if (applyToCatalogBtn) applyToCatalogBtn.addEventListener('click', sendPriceToProductCatalog);
  }

  function bindNumberInput(elementId, stateKey, syncBothModes = false, callback = null) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      appState[stateKey] = isNaN(val) ? 0 : val;

      if (syncBothModes) {
        // Sync corresponding input in the other mode
        if (elementId.startsWith('calc-b-')) {
          const compId = elementId.replace('calc-b-', 'calc-c-');
          const compEl = document.getElementById(compId);
          if (compEl && compEl !== el) compEl.value = appState[stateKey];
        } else if (elementId.startsWith('calc-c-')) {
          const begId = elementId.replace('calc-c-', 'calc-b-');
          const begEl = document.getElementById(begId);
          if (begEl && begEl !== el) begEl.value = appState[stateKey];
        }
      }

      if (callback) callback();
      saveCurrentSettings();
      updateAll();
    });
  }

  function bindTextInput(elementId, stateKey) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.addEventListener('input', (e) => {
      appState[stateKey] = e.target.value;
      saveCurrentSettings();
      updateAll();
    });
  }

  // ── 7. RENDER & REACTIVE UPDATE ──────────────────────────────────
  function updateAll() {
    const results = calculateRate(appState);

    // Sync all displays
    renderBeginnerView(results);
    renderComplexView(results);
    renderSummaryCard(results);
    renderCostDistributionBar(results);
    renderQuotationPreview(results);
  }

  function renderBeginnerView(results) {
    // Beginner Hero Price Card
    setText('calc-b-result-price', `₹${results.finalUnitPrice}`);
    setText('calc-b-result-cost', `₹${results.unitProductionCost}`);
    setText('calc-b-result-profit', `+₹${results.unitProfit} (${results.effectiveMarginPercent}% margin)`);

    // Beginner Breakdown Badges
    setText('calc-b-breakdown-material', `₹${results.materialCost}`);
    setText('calc-b-breakdown-depr', `₹${results.depreciationCost} (₹${results.hourlyDepreciation}/hr)`);
    setText('calc-b-breakdown-maint', `₹${results.maintenanceCost} (₹${results.hourlyMaintenance}/hr)`);
    setText('calc-b-breakdown-power', `₹${results.powerCost} (${results.powerKwh} kWh)`);
    setText('calc-b-breakdown-buffer', `₹${results.failureCost}`);

    // Time helper
    setText('calc-b-time-helper', `Total: ${results.formattedTime} (${results.totalPrintHours} hrs)`);
    setText('calc-b-rate-per-gram', `₹${results.costPerGram}/g`);
  }

  function renderComplexView(results) {
    // Complex Detailed Metrics
    setText('calc-c-cost-material', `₹${results.materialCost}`);
    setText('calc-c-cost-depr', `₹${results.depreciationCost}`);
    setText('calc-c-cost-maint', `₹${results.maintenanceCost}`);
    setText('calc-c-cost-power', `₹${results.powerCost}`);
    setText('calc-c-cost-machine-sub', `₹${results.machineRunCost}`);
    setText('calc-c-cost-failure', `₹${results.failureCost}`);
    setText('calc-c-cost-labor', `₹${results.laborCost}`);
    setText('calc-c-cost-prep', `₹${results.prepCost}`);
    setText('calc-c-cost-post', `₹${results.postCost}`);
    setText('calc-c-cost-hardware', `₹${results.hardwareCost}`);
    setText('calc-c-cost-packaging', `₹${results.packagingCost}`);
    setText('calc-c-cost-overhead', `₹${results.overheadCost}`);

    setText('calc-c-cogs', `₹${results.unitProductionCost}`);
    setText('calc-c-unit-profit', `₹${results.unitProfit}`);
    setText('calc-c-pre-tax', `₹${results.sellingPriceBeforeTax}`);
    setText('calc-c-tax-amount', `₹${results.taxAmount}`);
    setText('calc-c-final-unit', `₹${results.finalUnitPrice}`);
    setText('calc-c-wholesale', `₹${results.wholesaleUnitPrice}`);

    setText('calc-c-batch-cost', `₹${results.batchTotalCost}`);
    setText('calc-c-batch-rev', `₹${results.batchTotalRevenue}`);
    setText('calc-c-batch-profit', `₹${results.batchTotalProfit}`);
    setText('calc-c-hourly-rate', `₹${results.hourlyEarnings}/hr`);
    setText('calc-c-margin-pct', `${results.effectiveMarginPercent}%`);

    setText('calc-c-time-helper', `Total: ${results.formattedTime} (${results.totalPrintHours} hrs)`);
    setText('calc-c-rate-per-gram', `₹${results.costPerGram}/g`);
    setText('calc-c-gross-grams', `~${results.grossWeightGrams}g with waste`);
  }

  function renderSummaryCard(results) {
    // Top-right floating / sticky summary stats
    setText('calc-summary-hero-price', `₹${results.finalUnitPrice}`);
    setText('calc-summary-cost', `₹${results.unitProductionCost}`);
    setText('calc-summary-profit', `₹${results.unitProfit}`);
    setText('calc-summary-margin', `${results.effectiveMarginPercent}%`);
    setText('calc-summary-machine-hr', `₹${results.hourlyEarnings}/hr`);
  }

  function renderCostDistributionBar(results) {
    const shares = results.breakdownShares;
    setBarSegment('calc-bar-mat', shares.material, `Material: ${shares.material}%`);
    setBarSegment('calc-bar-depr', shares.depreciation, `Depreciation: ${shares.depreciation}%`);
    setBarSegment('calc-bar-maint', shares.maintenance, `Maintenance: ${shares.maintenance}%`);
    setBarSegment('calc-bar-power', shares.power, `Electricity: ${shares.power}%`);
    setBarSegment('calc-bar-labor', shares.labor, `Labor: ${shares.labor}%`);
    setBarSegment('calc-bar-buffer', shares.overheadsAndBuffer, `Buffer & Overheads: ${shares.overheadsAndBuffer}%`);
    setBarSegment('calc-bar-profit', shares.profit, `Profit: ${shares.profit}%`);
  }

  function setBarSegment(id, pct, title) {
    const el = document.getElementById(id);
    if (!el) return;
    const safePct = Math.max(0, Math.min(100, pct || 0));
    el.style.width = `${safePct}%`;
    el.style.display = safePct > 0.5 ? 'block' : 'none';
    el.setAttribute('title', title);
  }

  function renderQuotationPreview(results) {
    const quoteText = generateQuotationText(appState, results);
    const previewEl = document.getElementById('calc-quote-preview-text');
    if (previewEl) previewEl.textContent = quoteText;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ── 8. ACTIONS: QUOTATION & PRESETS ──────────────────────────────
  function copyQuotationToClipboard() {
    const results = calculateRate(appState);
    const text = generateQuotationText(appState, results);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        window.showAdminToast?.('Quotation copied to clipboard! Ready to paste in WhatsApp/Email.', 'success');
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      window.showAdminToast?.('Quotation copied to clipboard!', 'success');
    } catch (e) {
      alert('Could not copy quotation. Please select and copy manually:\n\n' + text);
    }
    document.body.removeChild(ta);
  }

  function printQuotationSlip() {
    const results = calculateRate(appState);
    const printer = PRINTER_PRESETS[appState.printerId] || PRINTER_PRESETS.kobra2neo;
    const filament = FILAMENT_PRESETS[appState.filamentKey] || { name: appState.filamentName };

    const printWin = window.open('', '_blank', 'width=700,height=800');
    if (!printWin) {
      window.showAdminToast?.('Please allow popups to print the quote slip.', 'warning');
      return;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>3D Print Job Quote - ${escapeHtml(appState.productName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; color: #0f172a; line-height: 1.5; }
    .header { border-bottom: 2px solid #f59e0b; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .brand h1 { margin: 0; font-size: 22px; color: #b45309; }
    .brand p { margin: 2px 0 0; font-size: 13px; color: #64748b; }
    .quote-badge { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; font-size: 13px; font-weight: 700; padding: 6px 12px; border-radius: 999px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .box h3 { margin: 0 0 8px; font-size: 14px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; }
    .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .row strong { color: #0f172a; }
    .total-box { background: #fffbeb; border: 2px solid #f59e0b; border-radius: 10px; padding: 18px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; }
    .total-val { font-size: 28px; font-weight: 800; color: #b45309; }
    .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <h1>Creative Souls 3D</h1>
      <p>Precision 3D Printing & Rapid Prototyping Workshop</p>
    </div>
    <div class="quote-badge">OFFICIAL ESTIMATE</div>
  </div>

  <div class="grid">
    <div class="box">
      <h3>Job Details</h3>
      <div class="row"><span>Job / Item:</span><strong>${escapeHtml(appState.productName)}</strong></div>
      ${appState.customerName ? `<div class="row"><span>Customer:</span><strong>${escapeHtml(appState.customerName)}</strong></div>` : ''}
      <div class="row"><span>Date:</span><strong>${new Date().toLocaleDateString('en-IN')}</strong></div>
      <div class="row"><span>Turnaround:</span><strong>${escapeHtml(appState.turnaroundDays)}</strong></div>
      <div class="row"><span>Quantity:</span><strong>${results.quantity} unit(s)</strong></div>
    </div>

    <div class="box">
      <h3>Manufacturing Specs</h3>
      <div class="row"><span>Machine:</span><strong>${escapeHtml(printer.name)}</strong></div>
      <div class="row"><span>Filament:</span><strong>${escapeHtml(filament.name)}</strong></div>
      <div class="row"><span>Print Weight:</span><strong>~${results.netWeightGrams}g</strong></div>
      <div class="row"><span>Print Time:</span><strong>${results.formattedTime}</strong></div>
      <div class="row"><span>Hourly Wear & Depr:</span><strong>₹${results.hourlyDepreciation + results.hourlyMaintenance}/hr</strong></div>
    </div>
  </div>

  <div class="box">
    <h3>Cost Breakdown (Internal Reference)</h3>
    <div class="row"><span>Filament Material (${results.grossWeightGrams}g @ ₹${results.costPerGram}/g):</span><span>₹${results.materialCost}</span></div>
    <div class="row"><span>Machine Depreciation (${printer.shortName} @ ₹${results.hourlyDepreciation}/hr):</span><span>₹${results.depreciationCost}</span></div>
    <div class="row"><span>Machine Maintenance Wear (@ ₹${results.hourlyMaintenance}/hr):</span><span>₹${results.maintenanceCost}</span></div>
    <div class="row"><span>Power & Electricity (${printer.powerWatts}W @ ₹${appState.electricityRatePerKwh}/unit):</span><span>₹${results.powerCost}</span></div>
    ${results.laborCost > 0 ? `<div class="row"><span>Labor & Post-processing:</span><span>₹${results.laborCost}</span></div>` : ''}
    ${results.hardwareCost > 0 ? `<div class="row"><span>Hardware & Packaging:</span><span>₹${results.hardwareCost + results.packagingCost}</span></div>` : ''}
    <div class="row" style="border-top:1px dashed #cbd5e1; margin-top:4px; padding-top:4px;"><span>Direct Cost of Production (COGS):</span><strong>₹${results.unitProductionCost}</strong></div>
  </div>

  <div class="total-box">
    <div>
      <div style="font-size:12px; font-weight:700; color:#92400e; text-transform:uppercase;">Final Quoted Rate</div>
      <div style="font-size:13px; color:#78350f;">Quality checked, post-processed & ready for pickup / delivery</div>
    </div>
    <div class="total-val">₹${appState.quantity > 1 ? results.batchTotalRevenue : results.finalUnitPrice}</div>
  </div>

  <div class="footer">
    Creative Souls 3D · High-Fidelity 3D Printing & Design · Generated via Admin Suite
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  }

  function sendPriceToProductCatalog() {
    const results = calculateRate(appState);

    // If admin panel has create-product button or function, invoke it
    const createBtn = document.getElementById('create-product');
    if (createBtn) {
      // First switch section to products
      if (typeof window.navigateTo === 'function') {
        window.navigateTo('products');
      }

      // Pre-populate fields in active document editor after short delay
      setTimeout(() => {
        createBtn.click();
        setTimeout(() => {
          const nameInput = document.getElementById('admin-edit-productName');
          const priceInput = document.getElementById('admin-edit-price');
          const descInput = document.getElementById('admin-edit-description');

          if (priceInput) priceInput.value = results.finalUnitPrice;
          if (nameInput && !nameInput.value) nameInput.value = appState.productName;
          if (descInput && !descInput.value) {
            descInput.value = `3D printed using ${appState.filamentName} on ${appState.printerName}. Estimated weight: ${appState.weightGrams}g.`;
          }
          window.showAdminToast?.(`Price ₹${results.finalUnitPrice} applied to product editor!`, 'success');
        }, 300);
      }, 200);
    } else {
      window.showAdminToast?.(`Calculated selling price is ₹${results.finalUnitPrice}.`, 'info');
    }
  }

  function promptSavePreset() {
    const name = prompt('Enter a name for this rate calculation preset (e.g. "Lithophane Light", "PETG Bracket", "Silk Vase"):', appState.productName);
    if (!name || !name.trim()) return;

    try {
      const presets = getStoredPresets();
      presets[name.trim()] = Object.assign({}, appState, { presetName: name.trim() });
      localStorage.setItem('cs3d_rate_calc_presets', JSON.stringify(presets));
      updatePresetDropdown();
      window.showAdminToast?.(`Preset "${name.trim()}" saved successfully!`, 'success');
    } catch (e) {
      window.showAdminToast?.('Could not save preset to browser storage.', 'error');
    }
  }

  function getStoredPresets() {
    try {
      const data = localStorage.getItem('cs3d_rate_calc_presets');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  function updatePresetDropdown() {
    const select = document.getElementById('calc-preset-select');
    if (!select) return;

    const presets = getStoredPresets();
    select.innerHTML = '<option value="">-- Load Saved Preset --</option>';

    // Built-in presets
    const builtins = [
      { id: 'b_keychain', name: '⚡ Quick Keychain (15g PLA)', state: { weightGrams: 15, hours: 0, minutes: 45, filamentKey: 'pla_std', markupPercent: 50, productName: 'Custom Keychain' } },
      { id: 'b_vase', name: '🏺 Silk Decorative Vase (120g Silk PLA)', state: { weightGrams: 120, hours: 6, minutes: 30, filamentKey: 'silk', markupPercent: 75, productName: 'Spiral Silk Vase' } },
      { id: 'b_bracket', name: '🔧 Heavy-Duty PETG Bracket (95g)', state: { weightGrams: 95, hours: 4, minutes: 15, filamentKey: 'petg', markupPercent: 50, printerId: 'kobrax', productName: 'Functional Wall Bracket' } },
      { id: 'b_lithophane', name: '💡 Lithophane Photo Lamp (180g)', state: { weightGrams: 180, hours: 10, minutes: 0, filamentKey: 'pla_plus', markupPercent: 80, productName: 'Curved Photo Lithophane' } }
    ];

    const optgroupBuiltin = document.createElement('optgroup');
    optgroupBuiltin.label = 'Sample Presets';
    builtins.forEach(b => {
      const opt = document.createElement('option');
      opt.value = `builtin:${b.id}`;
      opt.textContent = b.name;
      optgroupBuiltin.appendChild(opt);
    });
    select.appendChild(optgroupBuiltin);

    // User saved presets
    const keys = Object.keys(presets);
    if (keys.length > 0) {
      const optgroupUser = document.createElement('optgroup');
      optgroupUser.label = 'My Saved Presets';
      keys.forEach(k => {
        const opt = document.createElement('option');
        opt.value = `user:${k}`;
        opt.textContent = `★ ${k}`;
        optgroupUser.appendChild(opt);
      });
      select.appendChild(optgroupUser);
    }
  }

  function loadNamedPreset(val) {
    if (!val) return;

    if (val.startsWith('builtin:')) {
      const id = val.replace('builtin:', '');
      const samples = {
        b_keychain: { weightGrams: 15, hours: 0, minutes: 45, filamentKey: 'pla_std', markupPercent: 50, productName: 'Custom Keychain' },
        b_vase: { weightGrams: 120, hours: 6, minutes: 30, filamentKey: 'silk', markupPercent: 75, productName: 'Spiral Silk Vase' },
        b_bracket: { weightGrams: 95, hours: 4, minutes: 15, filamentKey: 'petg', markupPercent: 50, printerId: 'kobrax', productName: 'Functional Wall Bracket' },
        b_lithophane: { weightGrams: 180, hours: 10, minutes: 0, filamentKey: 'pla_plus', markupPercent: 80, productName: 'Curved Photo Lithophane' }
      };
      if (samples[id]) {
        applyPresetState(samples[id]);
        window.showAdminToast?.('Loaded sample preset!', 'info');
      }
    } else if (val.startsWith('user:')) {
      const key = val.replace('user:', '');
      const presets = getStoredPresets();
      if (presets[key]) {
        applyPresetState(presets[key]);
        window.showAdminToast?.(`Loaded preset "${key}"!`, 'success');
      }
    }
  }

  function applyPresetState(partial) {
    appState = Object.assign({}, appState, partial);

    // If printer specified, re-sync printer defaults
    if (partial.printerId) {
      selectPrinter(partial.printerId);
    }
    // If filament specified, re-sync filament
    if (partial.filamentKey) {
      selectFilament(partial.filamentKey);
    }

    // Update all inputs across DOM
    syncAllInputsFromState();
    saveCurrentSettings();
    updateAll();
  }

  function syncAllInputsFromState() {
    setVal('calc-b-hours', appState.hours);
    setVal('calc-b-minutes', appState.minutes);
    setVal('calc-b-weight', appState.weightGrams);
    setVal('calc-b-spool-price', appState.spoolPrice);

    setVal('calc-c-hours', appState.hours);
    setVal('calc-c-minutes', appState.minutes);
    setVal('calc-c-weight', appState.weightGrams);
    setVal('calc-c-spool-price', appState.spoolPrice);
    setVal('calc-c-spool-grams', appState.spoolGrams);
    setVal('calc-c-waste', appState.wastePercent);

    setVal('calc-c-machine-cost', appState.printerCost);
    setVal('calc-c-lifespan', appState.lifespanHours);
    setVal('calc-c-depr-rate', appState.hourlyDepreciation);
    setVal('calc-c-maint-rate', appState.hourlyMaintenance);
    setVal('calc-c-watts', appState.powerWatts);
    setVal('calc-c-power-rate', appState.electricityRatePerKwh);

    setVal('calc-c-prep-mins', appState.prepMinutes);
    setVal('calc-c-post-mins', appState.postMinutes);
    setVal('calc-c-labor-rate', appState.laborRatePerHour);
    setVal('calc-c-hardware', appState.hardwareCost);
    setVal('calc-c-packaging', appState.packagingCost);

    setVal('calc-c-failure', appState.failurePercent);
    setVal('calc-c-overhead', appState.overheadRatePerHour);
    setVal('calc-c-markup', appState.markupPercent);
    setVal('calc-b-markup-custom', appState.markupPercent);
    setVal('calc-c-tax', appState.taxPercent);
    setVal('calc-c-qty', appState.quantity);
    setVal('calc-c-wholesale', appState.wholesaleDiscountPercent);

    setVal('calc-quote-product', appState.productName);
    setVal('calc-quote-customer', appState.customerName);
    setVal('calc-quote-turnaround', appState.turnaroundDays);

    syncPrinterInputs();

    // Markup chips
    document.querySelectorAll('.calc-markup-chip').forEach(c => {
      c.classList.toggle('active', Number(c.dataset.markup) === appState.markupPercent);
    });
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function resetToDefaults() {
    if (!confirm('Reset all Rate Calculator values back to defaults?')) return;
    appState = Object.assign({}, DEFAULT_STATE);
    selectPrinter('kobra2neo');
    selectFilament('pla_std');
    syncAllInputsFromState();
    saveCurrentSettings();
    updateAll();
    window.showAdminToast?.('Rate Calculator reset to standard defaults.', 'info');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── 9. PUBLIC API ────────────────────────────────────────────────
  return {
    PRINTER_PRESETS,
    FILAMENT_PRESETS,
    DEFAULT_STATE,
    calculateRate,
    generateQuotationText,
    init: initUI,
    switchMode,
    selectPrinter,
    selectFilament,
    getState: () => Object.assign({}, appState),
    setState: (newState) => {
      appState = Object.assign({}, appState, newState);
      updateAll();
    },
    updatePresetDropdown
  };
});

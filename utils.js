// Utility functions for the Water Distribution Game

// Tooltip data with information for each slider
const TOOLTIP_DATA = {
  "qualitySlider": {
    title: "Initial Quality at Treatment Plant",
    content: "Controls the initial chlorine concentration at the water source (R-1). Higher values provide better disinfection but may cause taste issues. EPA recommends 0.2-4.0 mg/L, with optimal values typically between 1.0-2.0 mg/L."
  },
  "costSlider": {
    title: "Water Cost",
    content: "Sets the price charged to customers per 4,000 gallons. Higher prices increase revenue but may reduce customer demand and satisfaction. Lower prices may increase consumption but could result in operating at a loss."
  }
};

// Tracked nodes for the simulation
export const TRACKED_NODES = [
  "J-1-37", "J-1-38", "J-1-58",
  "J-5-15", "J-5-12", "J-5-13",
  "J-6", "J-6-65", "J-9-5",
  "J-8-8", "J-10-3"
];

// Function to update the background fill of sliders
export function updateFilledSlider(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const val = parseFloat(slider.value);
  const percentage = ((val - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(90deg, var(--primary) 0%, var(--primary) ${percentage}%, var(--dark) ${percentage}%, var(--dark) 100%)`;
}

// Initialize slider functionality
export function initializeSliders() {
  // Update filled slider visuals after setting values
  document.querySelectorAll('.filled-slider').forEach(slider => {
    updateFilledSlider(slider);
  });
}

// Tooltip initialization
let tooltipsGloballyInitialized = false;

export function initializeTooltips() {
  if (tooltipsGloballyInitialized) {
    return;
  }

  const sliderContainers = document.querySelectorAll('.slider-container');

  sliderContainers.forEach(container => {
    const slider = container.querySelector('input[type="range"]');
    const label = container.querySelector('label');

    if (slider && label) {
      let helpIcon = null;
      const childNodes = Array.from(label.childNodes);

      // Look for existing help icon or create one
      for (const node of childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('?')) {
          const span = document.createElement('span');
          span.className = 'help-icon';
          span.textContent = '?';

          const text = node.textContent;
          const parts = text.split('?');
          const beforeText = document.createTextNode(parts[0]);
          const afterText = document.createTextNode(parts.slice(1).join('?'));

          label.insertBefore(beforeText, node);
          label.insertBefore(span, node);
          if (afterText.textContent.trim() !== '') {
            label.insertBefore(afterText, node);
          }
          label.removeChild(node);

          helpIcon = span;
          break;
        } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('help-icon')) {
          if (!node.closest('.tooltip-container')) {
            helpIcon = node;
            break;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE && node.textContent.trim() === '?') {
          if (!node.closest('.tooltip-container')) {
            helpIcon = node;
            helpIcon.className = 'help-icon';
            break;
          }
        }
      }

      if (!helpIcon) {
        helpIcon = document.createElement('span');
        helpIcon.className = 'help-icon';
        helpIcon.textContent = '?';
      } else {
        helpIcon.textContent = '?';
        if (!helpIcon.classList.contains('help-icon')) {
          helpIcon.classList.add('help-icon');
        }
      }

      const tooltipContainer = document.createElement('div');
      tooltipContainer.className = 'tooltip-container';

      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';

      const sliderId = slider.id;
      const data = TOOLTIP_DATA[sliderId] || {
        title: "Parameter Information",
        content: "Adjust this parameter to control system behavior."
      };

      tooltip.innerHTML = `
        <div class="tooltip-title">${data.title}</div>
        <div class="tooltip-content">${data.content}</div>
      `;

      tooltipContainer.appendChild(tooltip);

      if (helpIcon.parentNode) {
        helpIcon.parentNode.removeChild(helpIcon);
      }

      tooltipContainer.appendChild(helpIcon);
      label.appendChild(tooltipContainer);
    }
  });

  tooltipsGloballyInitialized = true;
}

// Initialize node toggle checkboxes
export function initializeNodeToggles() {
  const nodeToggles = document.getElementById('nodeToggles');
  
  // Clear existing toggles
  nodeToggles.innerHTML = '';
  
  TRACKED_NODES.forEach(node => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" data-node="${node}" checked> ${node}`;
    nodeToggles.appendChild(label);
  });

  // Add event listeners for visibility toggling
  nodeToggles.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', (event) => {
      const nodeId = event.target.getAttribute('data-node');
      const isVisible = event.target.checked;
      updateNodeVisibility(nodeId, isVisible);
    });
  });
}

// Update node visibility
function updateNodeVisibility(nodeId, visible) {
  const containers = document.querySelectorAll(`.node-container[data-node="${nodeId}"]`);
  containers.forEach(container => {
    container.style.display = visible ? 'block' : 'none';
  });
  window.dispatchEvent(new Event('resize'));
}

// Initialize tab navigation
export function initializeTabs() {
  const tabs = {
    'headTabBtn': 'head',
    'pressureTabBtn': 'pressure', 
    'demandTabBtn': 'demand',
    'qualityTabBtn': 'quality',
    'tankTabBtn': 'tank'
  };

  const dashboards = {
    'head': document.getElementById('headDashboard'),
    'pressure': document.getElementById('pressureDashboard'),
    'demand': document.getElementById('demandDashboard'),
    'quality': document.getElementById('qualityDashboard'),
    'tank': document.getElementById('tankDashboard')
  };

  Object.keys(tabs).forEach(buttonId => {
    const button = document.getElementById(buttonId);
    const tabName = tabs[buttonId];
    
    button.addEventListener('click', () => {
      // Hide all dashboards
      Object.values(dashboards).forEach(dashboard => {
        dashboard.style.display = 'none';
      });
      
      // Show selected dashboard
      dashboards[tabName].style.display = 'grid';
      
      // Update active tab styling
      Object.keys(tabs).forEach(id => {
        document.getElementById(id).classList.remove('active');
      });
      button.classList.add('active');
      
      // Trigger resize for chart responsiveness
      window.dispatchEvent(new Event('resize'));
    });
  });
}

// Utility function to format numbers for display
export function formatNumber(value, decimals = 2) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.00';
  }
  return value.toFixed(decimals);
}

// Utility function to validate parameter ranges
export function validateParameter(value, min, max, paramName) {
  const numValue = parseFloat(value);
  
  if (isNaN(numValue)) {
    throw new Error(`${paramName} must be a valid number`);
  }
  
  if (numValue < min || numValue > max) {
    throw new Error(`${paramName} must be between ${min} and ${max}`);
  }
  
  return numValue;
}

// Utility function to debounce function calls
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Utility function to create a delay/sleep
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility function to calculate statistical values
export function calculateStatistics(values) {
  if (!values || values.length === 0) {
    return { 
      mean: 0, 
      median: 0, 
      stdDev: 0, 
      min: 0, 
      max: 0,
      count: 0 
    };
  }

  // Calculate mean
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  // Calculate median
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? 
    (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  // Calculate standard deviation
  const squareDiffs = values.map(value => {
    const diff = value - mean;
    return diff * diff;
  });
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  const stdDev = Math.sqrt(avgSquareDiff);

  return {
    mean,
    median,
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length
  };
}

// Utility function to generate unique IDs
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Utility function to safely parse JSON
export function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return defaultValue;
  }
}

// Utility function to check if browser supports required features
export function checkBrowserSupport() {
  const features = {
    webassembly: typeof WebAssembly !== 'undefined',
    canvas: !!document.createElement('canvas').getContext,
    localStorage: typeof Storage !== 'undefined',
    fetch: typeof fetch !== 'undefined'
  };

  const unsupported = Object.keys(features).filter(feature => !features[feature]);
  
  if (unsupported.length > 0) {
    console.warn('Unsupported browser features:', unsupported);
    return { supported: false, missing: unsupported };
  }

  return { supported: true, missing: [] };
}

// Initialize browser support check on module load
export const browserSupport = checkBrowserSupport();
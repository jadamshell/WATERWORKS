// Main application entry point
import { WaterSimulation } from './simulation.js';
import { ChartManager } from './charts.js';
import { 
  initializeTooltips, 
  updateFilledSlider, 
  initializeSliders,
  initializeNodeToggles,
  initializeTabs 
} from './utils.js';

class WaterWorksApp {
  constructor() {
    this.simulation = new WaterSimulation();
    this.chartManager = new ChartManager();
    this.isRunning = false;
    
    this.initializeApp();
  }

  async initializeApp() {
    console.log('Initializing WaterWorks Control System...');
    
    // Initialize UI components
    this.initializeUI();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize tooltips and other UI enhancements
    initializeTooltips();
    initializeSliders();
    
    console.log('WaterWorks Control System initialized successfully');
  }

  initializeUI() {
    // Initialize sliders
    const qualitySlider = document.getElementById('qualitySlider');
    const costSlider = document.getElementById('costSlider');
    
    // Set up filled slider backgrounds
    updateFilledSlider(qualitySlider);
    updateFilledSlider(costSlider);
    
    // Initialize node toggles
    initializeNodeToggles();
    
    // Initialize tab navigation
    initializeTabs();
    
    // Update status
    document.getElementById('status').textContent = 'Ready';
  }

  setupEventListeners() {
    // Slider event listeners
    this.setupSliderListeners();
    
    // Run button event listener
    document.getElementById('runBtn').addEventListener('click', () => {
      if (!this.isRunning) {
        this.runSimulation();
      }
    });
    
    // Window resize event for chart responsiveness
    window.addEventListener('resize', () => {
      this.chartManager.handleResize();
    });
  }

  setupSliderListeners() {
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValueSpan = document.getElementById('qualityValue');
    const costSlider = document.getElementById('costSlider');
    const costValueSpan = document.getElementById('costValue');

    qualitySlider.addEventListener('input', (event) => {
      qualityValueSpan.textContent = event.target.value;
      updateFilledSlider(qualitySlider);
      this.simulation.setInitialQuality(parseFloat(event.target.value));
    });

    costSlider.addEventListener('input', (event) => {
      costValueSpan.textContent = event.target.value;
      updateFilledSlider(costSlider);
      this.simulation.setWaterCost(parseFloat(event.target.value));
    });
  }

  async runSimulation() {
    if (this.isRunning) {
      console.warn('Simulation already running');
      return;
    }

    this.isRunning = true;
    const runBtn = document.getElementById('runBtn');
    const statusDiv = document.getElementById('status');
    
    try {
      // Disable run button and update status
      runBtn.disabled = true;
      runBtn.textContent = 'Running...';
      statusDiv.textContent = 'Initializing simulation...';
      
      // Setup charts for new simulation
      this.chartManager.setupCharts();
      
      // Get current parameter values
      const quality = parseFloat(document.getElementById('qualitySlider').value);
      const cost = parseFloat(document.getElementById('costSlider').value);
      
      console.log(`Starting simulation with quality: ${quality}, cost: $${cost}`);
      
      // Run the simulation with progress callbacks
      await this.simulation.run(
        quality,
        cost,
        (progress, phase) => this.updateProgress(progress, phase),
        (data) => this.chartManager.updateCharts(data)
      );
      
      statusDiv.textContent = 'Simulation complete!';
      
    } catch (error) {
      console.error('Simulation error:', error);
      statusDiv.textContent = `Error: ${error.message}`;
    } finally {
      // Re-enable run button
      this.isRunning = false;
      runBtn.disabled = false;
      runBtn.textContent = 'Run Simulation';
      
      // Final progress update
      document.getElementById('simProgress').value = 100;
      document.getElementById('progressPercentage').textContent = '100%';
    }
  }

  updateProgress(progress, phase) {
    const simProgress = document.getElementById('simProgress');
    const progressPercentage = document.getElementById('progressPercentage');
    const statusDiv = document.getElementById('status');
    
    // Update progress bar
    simProgress.value = progress;
    progressPercentage.textContent = `${Math.round(progress)}%`;
    
    // Update progress bar style based on phase
    if (phase === 'hydraulic') {
      simProgress.classList.add('hydraulic');
      simProgress.classList.remove('quality');
      statusDiv.textContent = 'Running hydraulic simulation...';
    } else if (phase === 'quality') {
      simProgress.classList.remove('hydraulic');
      simProgress.classList.add('quality');
      statusDiv.textContent = 'Running water quality simulation...';
    }
  }

  // Method to handle node visibility toggling
  updateNodeVisibility(nodeId, visible) {
    this.chartManager.updateNodeVisibility(nodeId, visible);
  }

  // Method to switch between chart tabs
  switchTab(tabName) {
    this.chartManager.switchTab(tabName);
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.waterWorksApp = new WaterWorksApp();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  window.waterWorksApp = new WaterWorksApp();
}

// Export for potential external use
export { WaterWorksApp };
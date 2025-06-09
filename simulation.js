// EPANET simulation handling
import { Project, Workspace, InitHydOption, NodeProperty, ObjectType, NodeType } from "https://cdn.skypack.dev/epanet-js@0.7.0";
import { martinCountyINP } from '../data/martin-county-network.js';

// EPANET parameter codes
const EN_DEMAND = 9;
const EN_HEAD = 10;
const EN_PRESSURE = 11;
const EN_QUALITY = 12;

// Demand adjustment configuration based on Dr. Ormsbee's research
const DEMAND_ADJUSTMENTS = {
  "High": {
    nodes: ["J-1-37", "J-1-38", "J-1-58"],
    multipliers: [1.10, 1.05, 1.00],
    consumptionFunction: function(x) { return -3.1057 * x + 435.93; },
    extra: 1.05
  },
  "Medium": {
    nodes: ["J-5-15", "J-5-12", "J-5-13", "J-6"],
    multipliers: [1.15, 1.10, 1.05, 1.00],
    consumptionFunction: function(x) { return 0.0819 * x * x - 8.701 * x + 394.94; }
  },
  "Low": {
    nodes: ["J-6-65", "J-9-5", "J-8-8", "J-10-3"],
    multipliers: [1.15, 1.10, 1.05, 1.00],
    consumptionFunction: function(x) { return 0.1213 * x * x - 10.659 * x + 335.43; }
  }
};

const POPULATION_SIZE = 100;
const SIMULATION_HOURS = 168;

export class WaterSimulation {
  constructor() {
    this.initialQuality = 3.0;
    this.waterCost = 65;
    this.inpText = martinCountyINP; // Will be imported from data file
    this.trackedNodes = [
      "J-1-37", "J-1-38", "J-1-58",
      "J-5-15", "J-5-12", "J-5-13",
      "J-6", "J-6-65", "J-9-5",
      "J-8-8", "J-10-3"
    ];
  }

  setInitialQuality(quality) {
    this.initialQuality = quality;
    console.log(`Initial quality set to: ${quality} mg/L`);
  }

  setWaterCost(cost) {
    this.waterCost = cost;
    console.log(`Water cost set to: $${cost}`);
  }

  // Update demand values in INP based on water cost and population
  updateDemandInINP(inp, cost) {
    const groups = {
      "High": {
        nodes: DEMAND_ADJUSTMENTS["High"].nodes,
        multipliers: DEMAND_ADJUSTMENTS["High"].multipliers,
        baseFunc: DEMAND_ADJUSTMENTS["High"].consumptionFunction,
        extra: DEMAND_ADJUSTMENTS["High"].extra
      },
      "Medium": {
        nodes: DEMAND_ADJUSTMENTS["Medium"].nodes,
        multipliers: DEMAND_ADJUSTMENTS["Medium"].multipliers,
        baseFunc: DEMAND_ADJUSTMENTS["Medium"].consumptionFunction
      },
      "Low": {
        nodes: DEMAND_ADJUSTMENTS["Low"].nodes,
        multipliers: DEMAND_ADJUSTMENTS["Low"].multipliers,
        baseFunc: DEMAND_ADJUSTMENTS["Low"].consumptionFunction
      }
    };

    const adjustments = {};
    for (const group in groups) {
      let base = groups[group].baseFunc(cost);
      if (group === "High") {
        base *= groups[group].extra;
      }
      // Convert from GPD to GPM and apply population multiplier
      const baseGPM = (base * POPULATION_SIZE) / 1440;
      adjustments[group] = groups[group].multipliers.map(mult => (baseGPM * mult).toFixed(2));
    }

    // Update the JUNCTIONS section
    const junctionRegex = /(\[JUNCTIONS\][\s\S]*?)(?=\n\[)/i;
    const match = inp.match(junctionRegex);
    if (!match) return inp;

    let junctionSection = match[1];
    let lines = junctionSection.split("\n");
    
    lines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(";") || !trimmed.match(/^[A-Za-z0-9\-@]+/)) {
        return line;
      }
      
      const tokens = trimmed.split(/\s+/);
      const nodeId = tokens[0];
      
      for (const group in groups) {
        const index = groups[group].nodes.indexOf(nodeId);
        if (index !== -1) {
          tokens[2] = adjustments[group][index];
          return tokens.join("\t");
        }
      }
      return line;
    });

    const newJunctionSection = lines.join("\n");
    inp = inp.replace(junctionRegex, newJunctionSection);
    
    console.log(`Demand values updated for cost $${cost} and population ${POPULATION_SIZE}`);
    return inp;
  }

  // Ensure all nodes have quality values defined
  ensureQualitySection(inp) {
    let nodes = [];
    const sections = ["JUNCTIONS", "RESERVOIRS", "TANKS"];
    
    sections.forEach(section => {
      const regex = new RegExp("\\[" + section + "\\]([\\s\\S]*?)(\\[[^\\]]+\\]|$)", "i");
      const match = inp.match(regex);
      if (match) {
        match[1].split("\n").forEach(line => {
          const cleanLine = line.split(";")[0].trim();
          if (cleanLine) {
            const tokens = cleanLine.split(/\s+/);
            if (tokens[0]) nodes.push(tokens[0]);
          }
        });
      }
    });

    let qualityRegex = /\[QUALITY\]([\s\S]*?)(\[[^\]]+\]|$)/i;
    let qualityMatch = inp.match(qualityRegex);
    let qualityNodes = new Set();
    let qualitySection = "";

    if (qualityMatch) {
      qualitySection = qualityMatch[1];
      qualitySection.split("\n").forEach(line => {
        const cleanLine = line.split(";")[0].trim();
        if (cleanLine) {
          const tokens = cleanLine.split(/\s+/);
          if (tokens[0]) qualityNodes.add(tokens[0]);
        }
      });
    } else {
      inp += "\n[QUALITY]\n";
      qualitySection = "";
    }

    let missing = [];
    nodes.forEach(node => {
      if (!qualityNodes.has(node)) {
        missing.push(node + "\t0");
      }
    });

    if (missing.length > 0) {
      let newQualitySection = qualitySection.trim() + "\n" + missing.join("\n") + "\n";
      inp = inp.replace(qualityRegex, "[QUALITY]\n" + newQualitySection + "$2");
    }

    return inp;
  }

  // Set initial quality for all nodes in the model
  setInitialQualityInModel(model, reservoirQuality) {
    try {
      const nodeCount = model.getCount(ObjectType.Node);
      console.log(`Setting initial quality for ${nodeCount} nodes`);
      
      for (let i = 1; i <= nodeCount; i++) {
        try {
          const nodeType = model.getNodeType(i);
          let nodeName = "Unknown";
          try { 
            nodeName = model.getNodeId(i); 
          } catch (e) {
            console.warn(`Could not get name for node index ${i}`);
          }
          
          if (nodeType === NodeType.Reservoir) {
            console.log(`Setting reservoir ${nodeName} (index ${i}) quality to ${reservoirQuality}`);
            model.setNodeValue(i, NodeProperty.Initqual, reservoirQuality);
          } else {
            model.setNodeValue(i, NodeProperty.Initqual, 0);
          }
        } catch (e) {
          console.error(`Error setting quality for node index ${i}:`, e);
        }
      }

      // Verify R-1 quality setting
      try {
        const r1Index = model.getNodeIndex("R-1");
        const r1Qual = model.getNodeValue(r1Index, NodeProperty.Initqual);
        console.log(`Confirmed R-1 quality: ${r1Qual}`);
      } catch (e) {
        console.error("Error verifying R-1 quality:", e);
      }

      return true;
    } catch (error) {
      console.error("Error in setInitialQualityInModel:", error);
      return false;
    }
  }

  // Main simulation runner
  async run(quality, cost, progressCallback, dataCallback) {
    this.setInitialQuality(quality);
    this.setWaterCost(cost);

    let model;
    let ws;

    try {
      // Initialize EPANET with retry logic
      await this.initializeEPANET().then(({ workspace, project }) => {
        ws = workspace;
        model = project;
      });

      // Update INP with current parameters
      let updatedINP = this.updateDemandInINP(this.inpText, cost);
      updatedINP = this.ensureQualitySection(updatedINP);

      // Write and open model
      ws.writeFile("model.inp", updatedINP);
      model.open("model.inp", "report.rpt", "out.bin");

      // Run hydraulic simulation
      await this.runHydraulicSimulation(model, progressCallback, dataCallback);

      // Setup and run quality simulation  
      const qualitySetup = this.setInitialQualityInModel(model, quality);
      if (!qualitySetup) {
        throw new Error("Failed to set initial quality values");
      }

      model.saveH();
      model.openQ();
      model.initQ(InitHydOption.Save);

      await this.runQualitySimulation(model, progressCallback, dataCallback);

      // Cleanup
      model.closeQ();
      model.close();

      console.log("Simulation completed successfully");

    } catch (error) {
      console.error("Simulation error:", error);
      
      // Cleanup on error
      try {
        if (model) {
          model.closeQ();
          model.closeH();
          model.close();
        }
      } catch (cleanupError) {
        console.log("Model cleanup completed");
      }
      
      throw error;
    }
  }

  // Initialize EPANET with retry logic
  async initializeEPANET() {
    let initSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;
    let ws, model;

    while (!initSuccess && attempts < maxAttempts) {
      attempts++;
      console.log(`EPANET initialization attempt ${attempts}`);

      try {
        // Allow time for WebAssembly to load
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));

        ws = new Workspace();
        model = new Project(ws);

        // Test workspace functionality
        ws.writeFile("test.txt", "test");
        initSuccess = true;
        console.log("EPANET initialization successful");

      } catch (initError) {
        console.warn(`Initialization attempt ${attempts} failed:`, initError);
        if (attempts >= maxAttempts) {
          throw new Error(`Failed to initialize EPANET after ${maxAttempts} attempts. Latest error: ${initError.message}`);
        }
        // Clean up failed objects
        model = null;
        ws = null;
      }
    }

    return { workspace: ws, project: model };
  }

  // Run hydraulic simulation phase
  async runHydraulicSimulation(model, progressCallback, dataCallback) {
    model.openH();
    model.initH(InitHydOption.SaveAndInit);
    console.log("Hydraulic simulation initialized");

    let tStep = 1;
    let currentTime = 0;
    const totalSimSeconds = SIMULATION_HOURS * 3600;

    while (tStep > 0) {
      currentTime = model.runH();
      const currentTimeHours = currentTime / 3600;

      // Update progress
      const progressPercent = Math.min(50, (currentTime / totalSimSeconds) * 50);
      progressCallback(progressPercent, 'hydraulic');

      // Collect data at hourly intervals
      if (Math.abs(currentTimeHours - Math.round(currentTimeHours)) < 0.01) {
        const timeData = this.collectHydraulicData(model, Math.round(currentTimeHours));
        dataCallback(timeData);
      }

      tStep = model.nextH();
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    model.closeH();
    console.log("Hydraulic simulation completed");
  }

  // Run quality simulation phase
  async runQualitySimulation(model, progressCallback, dataCallback) {
    console.log("Starting quality simulation");

    let tStep = 1;
    let currentTime = 0;
    const totalSimSeconds = SIMULATION_HOURS * 3600;

    while (tStep > 0) {
      currentTime = model.runQ();
      const currentTimeHours = currentTime / 3600;

      // Update progress (50-100%)
      const progressPercent = Math.min(100, 50 + (currentTime / totalSimSeconds) * 50);
      progressCallback(progressPercent, 'quality');

      // Collect data at hourly intervals
      if (Math.abs(currentTimeHours - Math.round(currentTimeHours)) < 0.01) {
        const timeData = this.collectQualityData(model, Math.round(currentTimeHours));
        dataCallback(timeData);
      }

      tStep = model.nextQ();
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    console.log("Quality simulation completed");
  }

  // Collect hydraulic data for a time step
  collectHydraulicData(model, timeHours) {
    const data = {
      time: timeHours,
      type: 'hydraulic',
      nodes: {},
      tank: {}
    };

    // Collect data for tracked nodes
    this.trackedNodes.forEach(nodeId => {
      try {
        const idx = model.getNodeIndex(nodeId);
        data.nodes[nodeId] = {
          head: model.getNodeValue(idx, EN_HEAD),
          pressure: model.getNodeValue(idx, EN_PRESSURE),
          demand: model.getNodeValue(idx, EN_DEMAND)
        };
      } catch (e) {
        console.error(`Error collecting hydraulic data for node ${nodeId}:`, e);
      }
    });

    // Collect tank data
    try {
      const tankIndex = model.getNodeIndex("T-1");
      const tankHead = model.getNodeValue(tankIndex, EN_HEAD);
      const tankElevation = 1006.12;
      data.tank["T-1"] = {
        level: tankHead - tankElevation
      };
    } catch (e) {
      console.error("Error collecting tank data:", e);
    }

    return data;
  }

  // Collect quality data for a time step
  collectQualityData(model, timeHours) {
    const data = {
      time: timeHours,
      type: 'quality',
      nodes: {}
    };

    // Collect quality data for tracked nodes
    this.trackedNodes.forEach(nodeId => {
      try {
        const idx = model.getNodeIndex(nodeId);
        data.nodes[nodeId] = {
          quality: model.getNodeValue(idx, EN_QUALITY)
        };
      } catch (e) {
        console.error(`Error collecting quality data for node ${nodeId}:`, e);
      }
    });

    return data;
  }
}
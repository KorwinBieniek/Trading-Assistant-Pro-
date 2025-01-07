// File: scenario-manager.js

// Core class that handles all scenario data management and evaluation
// This is the backbone of the trading assistant - handles loading, saving, and evaluating trading scenarios
class ScenarioManager {
    constructor() {
      this.scenarios = {}; // Holds all trading scenarios
      this.currentScenario = null; // Currently selected scenario for quick access
    }
  
    // Tries to load scenarios from multiple sources in order of preference:
    // 1. Chrome storage (for persistence between sessions)
    // 2. JSON file (for initial setup/reset)
    // 3. Default scenario (fallback)
    async loadScenarios() {
      try {
        // Try Chrome storage first - most up-to-date source
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const result = await chrome.storage.local.get(['tradingScenarios']);
          if (result.tradingScenarios) {
            this.scenarios = result.tradingScenarios;
            return this.scenarios;
          }
        }
  
        // If no scenarios in storage, try loading from JSON file
        try {
          const response = await fetch(this.getScenariosJsonUrl());
          const scenariosData = await response.json();
          this.scenarios = scenariosData.scenarios || {};
          await this.saveScenarios(); // Cache the loaded scenarios
          return this.scenarios;
        } catch (error) {
          console.error('Error loading scenarios.json:', error);
          // Last resort - create a basic scenario template
          this.scenarios = {
            bullishBreakout: {
              name: "Bullish Breakout",
              conditions: {},
              outputs: {},
            },
          };
          return this.scenarios;
        }
      } catch (error) {
        console.error('Error in loadScenarios:', error);
        throw error;
      }
    }
  
    // Saves scenarios to storage and optionally to file
    // Added file backup after losing data during a Chrome crash
    async saveScenarios() {
        try {
            // Save to Chrome storage if available
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set({ tradingScenarios: this.scenarios });
            } else {
                // For development environment, log and save to file
                console.log('Saved scenarios (dev environment):', this.scenarios);
    
                // Backup to server
                await fetch('/scenarios.json', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ scenarios: this.scenarios }),
                });
            }
        } catch (error) {
            console.error('Error saving scenarios:', error);
            throw error;
        }
    }
    
    // Heart of the analysis system - evaluates conditions and calculates prediction
    // This is where all the trading logic comes together
    evaluateScenario(scenarioId, conditions) {
        try {
            const scenario = this.scenarios[scenarioId];
            if (!scenario) {
                throw new Error(`Scenario ${scenarioId} not found`);
            }
    
            let score = 0;
    
            console.log(`Starting scenario evaluation: ${scenarioId}`);
            console.log(`Input conditions:`, conditions);
    
            // Process each condition and calculate total score
            Object.keys(conditions).forEach((conditionKey) => {
                const condition = conditions[conditionKey];
                const scenarioCondition = scenario.conditions[conditionKey];
    
                if (!scenarioCondition) {
                    console.warn(`Condition '${conditionKey}' not defined in scenario '${scenarioId}'.`);
                    return;
                }
    
                if (condition.value !== null && condition.value !== undefined) {
                    // Handle different input types - each affects the score differently
                    switch (condition.type) {
                        case 'radio':
                        case 'select': {
                            const selectedOption = (scenarioCondition.options || []).find(
                                (option) => option.value === condition.value
                            );
                            if (selectedOption) {
                                console.debug(`Added weight for condition '${conditionKey}': ${selectedOption.weight}`);
                                score += selectedOption.weight || 0;
                            } else {
                                console.warn(`No matching option found for condition '${conditionKey}' (value: ${condition.value}).`);
                            }
                            break;
                        }
                        case 'checkbox': {
                            const checkboxWeight = condition.value ? scenarioCondition.weight || 0 : 0;
                            score += checkboxWeight;
                            console.debug(`Checkbox '${conditionKey}': ${condition.value ? 'checked' : 'unchecked'} (weight: ${checkboxWeight})`);
                            break;
                        }
                        case 'text': {
                            const textWeight = scenarioCondition.weight || 0;
                            score += textWeight;
                            console.debug(`Text '${conditionKey}': ${condition.value} (weight: ${textWeight})`);
                            break;
                        }
                        default: {
                            console.warn(`Unknown condition type: '${condition.type}' for key '${conditionKey}'.`);
                        }
                    }
                } else {
                    console.warn(`Condition '${conditionKey}' has missing value.`);
                }
            });
    
            console.log(`Total score for scenario '${scenarioId}': ${score}`);
    
            // Find the best matching output based on score thresholds
            const outputs = Object.values(scenario.outputs || {}).filter(
                (output) => score >= output.threshold
            );
    
            if (outputs.length > 0) {
                const bestOutput = outputs.sort((a, b) => b.threshold - a.threshold)[0];
                console.log(`Best output for scenario '${scenarioId}': ${bestOutput.message} (threshold: ${bestOutput.threshold})`);
                return {
                    type: bestOutput.type || 'neutral',
                    message: bestOutput.message || 'Unknown result',
                    score,
                };
            }
    
            console.log(`Neutral signal for scenario '${scenarioId}': no thresholds met.`);
            return {
                type: 'neutral',
                message: 'Neutral signal',
                score,
            };
        } catch (error) {
            console.error(`Error evaluating scenario '${scenarioId}':`, error);
            return { type: 'error', message: 'Analysis error', score: 0 };
        }
    }
    
    // Links a scenario to a specific market for analysis
    async assignScenarioToMarket(market, scenarioId) {
        try {
          const marketAssignments = await this.getMarketAssignments();
          marketAssignments[market] = scenarioId;
          await this.saveMarketAssignments(marketAssignments);
        } catch (error) {
          console.error(`Error assigning scenario to market ${market}:`, error);
        }
    }
  
    // Removes scenario assignment from a market
    async unassignScenarioFromMarket(market) {
      try {
        const marketAssignments = await this.getMarketAssignments();
        delete marketAssignments[market];
        await this.saveMarketAssignments(marketAssignments);
      } catch (error) {
        console.error('Error removing scenario assignment:', error);
        throw error;
      }
    }
  
    // Gets current scenario assignments for all markets
    async getMarketAssignments() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const result = await chrome.storage.local.get(['marketAssignments']);
          return result.marketAssignments || {};
        }
        return {};
      } catch (error) {
        console.error('Error getting market assignments:', error);
        return {};
      }
    }
  
    // Saves market-scenario assignments to storage
    async saveMarketAssignments(assignments) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ marketAssignments: assignments });
        } else {
          console.log('Saved market assignments (dev environment):', assignments);
        }
      } catch (error) {
        console.error('Error saving market assignments:', error);
        throw error;
      }
    }
  
    // Helper to get scenarios.json URL based on environment
    getScenariosJsonUrl() {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL('scenarios.json');
      }
      return 'scenarios.json';
    }
}
  
// Export for Node.js environment (e.g., for testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScenarioManager;
}
  
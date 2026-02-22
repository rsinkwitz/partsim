/**
 * CrossUpdate - Two-way synchronization library for React state
 *
 * Based on the original cross-update.js by Rainer Sinkwitz
 * Modernized for TypeScript and React Native
 *
 * Features:
 * - Cycle detection using generation counter
 * - Multiple watchers per control
 * - Automatic propagation of changes
 */

type UpdateFunction = (targetId: string, value: any) => void;

interface WatcherFunction {
  doFunction: (targetId: string, value: any) => void;
}

interface TargetRegistry {
  [fromId: string]: string[];
}

interface FunctionRegistry {
  [key: string]: WatcherFunction[];
}

interface GenerationRegistry {
  [id: string]: number;
}

class CrossUpdate {
  private targets: TargetRegistry = {};
  private functions: FunctionRegistry = {};
  private generation: number = 0;
  private generations: GenerationRegistry = {};

  /**
   * Register a watcher: when 'fromId' changes, call func.doFunction on 'targetId'
   * @param targetId - The control that will be updated
   * @param fromId - The control to watch for changes
   * @param func - Object with doFunction(targetId, value) method
   */
  watch(targetId: string, fromId: string, func: WatcherFunction): void {
    // Add 'targetId' to list of watchers for 'fromId'
    if (!this.targets[fromId]) {
      this.targets[fromId] = [];
    }
    if (!this.targets[fromId].includes(targetId)) {
      this.targets[fromId].push(targetId);
    }

    // Add 'func' to list of functions for this target/from pair
    const key = `${targetId}/${fromId}`;
    if (!this.functions[key]) {
      this.functions[key] = [];
    }
    this.functions[key].push(func);
  }

  /**
   * Notify that 'fromId' has changed to 'value'
   * This will trigger all registered watchers
   */
  notify(fromId: string, value: any): void {
    this.generation++;
    this.generations[fromId] = this.generation;
    this.notifyIntern(fromId, value, fromId);
  }

  /**
   * Internal recursive notification with cycle detection
   */
  private notifyIntern(fromId: string, value: any, path: string): void {
    if (!this.targets[fromId]) {
      return;
    }

    const targetsList = this.targets[fromId];

    for (const targetId of targetsList) {
      // Initialize generation if needed
      if (!this.generations[targetId]) {
        this.generations[targetId] = 0;
      }

      // Only update if this target hasn't been updated in this generation (cycle detection)
      if (this.generations[targetId] < this.generation) {
        this.generations[targetId] = this.generation;

        const key = `${targetId}/${fromId}`;
        const functionsList = this.functions[key];

        if (functionsList) {
          for (const funcObj of functionsList) {
            funcObj.doFunction(targetId, value);
          }

          // Recursively notify watchers of this target
          this.notifyIntern(targetId, value, `${targetId}/${path}`);
        }
      }
    }
  }

  /**
   * Clear all watchers (useful for cleanup)
   */
  clear(): void {
    this.targets = {};
    this.functions = {};
    this.generation = 0;
    this.generations = {};
  }

  /**
   * Remove watchers for a specific control
   */
  unwatch(controlId: string): void {
    // Remove from targets
    delete this.targets[controlId];

    // Remove from functions
    Object.keys(this.functions).forEach(key => {
      if (key.startsWith(`${controlId}/`) || key.endsWith(`/${controlId}`)) {
        delete this.functions[key];
      }
    });

    // Remove from generations
    delete this.generations[controlId];
  }
}

// Singleton instance
export const crossUpdate = new CrossUpdate();

// Helper function to create a simple sync function
export function createSyncFunction(updateCallback: UpdateFunction): WatcherFunction {
  return {
    doFunction: (targetId: string, value: any) => {
      updateCallback(targetId, value);
    }
  };
}

// Helper for bi-directional sync between two controls
export function syncBidirectional(
  id1: string,
  id2: string,
  updateCallback: UpdateFunction
): void {
  const syncFunc = createSyncFunction(updateCallback);
  crossUpdate.watch(id1, id2, syncFunc);
  crossUpdate.watch(id2, id1, syncFunc);
}

export default crossUpdate;


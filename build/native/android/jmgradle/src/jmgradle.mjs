import { utcStamp } from "./util.mjs";

export class JMGradleGraph {
  constructor(name = "JMGradle") {
    this.name = name;
    this.tasks = new Map();
  }

  task(name, definition) {
    if (this.tasks.has(name)) throw new Error(`Duplicate task: ${name}`);
    this.tasks.set(name, {
      name,
      dependsOn: definition.dependsOn ?? [],
      body: definition.body ?? "Unassigned",
      quadze: definition.quadze ?? "Q0",
      description: definition.description ?? "",
      run: definition.run
    });
    return this;
  }

  order(target) {
    if (!this.tasks.has(target)) throw new Error(`Unknown JMGradle task: ${target}`);
    const ordered = [];
    const temporary = new Set();
    const complete = new Set();

    const visit = (name) => {
      if (complete.has(name)) return;
      if (temporary.has(name)) throw new Error(`Task cycle detected at ${name}`);
      const task = this.tasks.get(name);
      if (!task) throw new Error(`Unknown dependency: ${name}`);
      temporary.add(name);
      task.dependsOn.forEach(visit);
      temporary.delete(name);
      complete.add(name);
      ordered.push(task);
    };
    visit(target);
    return ordered;
  }

  describe(target = "receipt") {
    return this.order(target).map(({ name, dependsOn, body, quadze, description }) => ({
      name,
      dependsOn,
      body,
      quadze,
      description
    }));
  }

  async execute(target, context) {
    context.trace ??= [];
    for (const task of this.order(target)) {
      const start = Date.now();
      context.trace.push({
        at: utcStamp(),
        event: "TASK_START",
        task: task.name,
        body: task.body,
        quadze: task.quadze
      });
      try {
        await task.run(context);
        context.trace.push({
          at: utcStamp(),
          event: "TASK_PASS",
          task: task.name,
          elapsedMs: Date.now() - start
        });
      } catch (error) {
        context.trace.push({
          at: utcStamp(),
          event: "TASK_BUGG",
          task: task.name,
          elapsedMs: Date.now() - start,
          message: error.message
        });
        throw error;
      }
    }
    return context;
  }
}

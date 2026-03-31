---
name: sunco:graph
description: Code dependency graph and blast radius analysis
allowed-tools:
  - Bash
  - Read
---

<objective>
Run the SUNCO graph skill to build a code dependency graph for the project and analyze it. Use `--stats` for aggregate graph metrics, and `--blast <file>` to determine how many files would be affected if a specific file changed (blast radius analysis). Deterministic: zero LLM cost.
</objective>

<process>
1. Run one of:
   - `node $HOME/.claude/sunco/bin/cli.js graph` — build and display the dependency graph summary
   - `node $HOME/.claude/sunco/bin/cli.js graph --stats` — show aggregate graph statistics
   - `node $HOME/.claude/sunco/bin/cli.js graph --blast <file>` — blast radius for a specific file
2. Display the output clearly:
   - For default graph: module count, edge count, detected cycles, most-connected nodes
   - For `--stats`: graph diameter, average fan-in/fan-out, top 10 most imported modules, circular dependency chains
   - For `--blast <file>`: the target file, how many files directly or transitively depend on it, the list of affected files grouped by layer
3. Based on the results:
   - If cycles are detected: list them and suggest which edge to remove to break each cycle
   - If a file has very high blast radius: suggest extracting the shared logic into a more stable abstraction
   - If a module has very high fan-in (many dependents): flag it as a stability risk
4. Suggest: "Run `/sunco:lint` to enforce the boundaries identified in this graph."
</process>

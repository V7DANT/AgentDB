# Benchmarking Protocol

AgentDB uses a controlled and reproducible benchmarking methodology to evaluate
database performance and the effect of automated optimizations.

The purpose of this protocol is to ensure that benchmark results are:
- reproducible,
- attributable to a clearly defined experiment,
- comparable when the experimental environment is controlled,
- and not incorrectly combined across different hardware environments.

---

## 1. Benchmarking Principles

Every benchmark experiment must have a clearly defined purpose.

We do not run arbitrary combinations of:
- thread counts,
- durations,
- dataset sizes,
- PostgreSQL configurations,
- or workload parameters.

Each experiment must answer a specific question.

For every experiment, the following must be documented:

- Objective
- Workload
- Dataset and scale
- PostgreSQL version
- Benchmark tool/version
- Hardware environment
- PostgreSQL configuration
- Benchmark parameters
- Number of repetitions
- Metrics collected
- Raw results
- Summary statistics
- Interpretation

---

## 2. Hardware and Environment Policy

Database performance is strongly dependent on the execution environment.

Therefore, AgentDB distinguishes between:

### Development Environment

Each team member may run workloads on their own machine for:

- development,
- debugging,
- validating benchmark scripts,
- testing database configurations,
- generating training/experimental data,
- and reproducing bugs.

These results are considered **development results** and are not combined
with official performance results.

### Canonical Evaluation Environment

Official performance comparisons are performed on a designated canonical
machine/environment.

The canonical environment should remain unchanged between the baseline and
optimization runs of an experiment.

The following should be recorded:

- CPU model
- Number of physical cores
- Number of logical CPUs
- RAM
- Storage device
- Operating system
- Kernel version where relevant
- Docker version
- PostgreSQL version
- Benchmark tool version
- AgentDB Git commit
- PostgreSQL configuration

---

## 3. Results from Multiple Machines

Results from different machines must never be directly averaged or combined
into a single absolute performance value.

For example, the following is invalid:

    Machine A: 800 TPS
    Machine B: 1200 TPS

    Combined result: 1000 TPS

This number has no clear experimental meaning because the machines have
different performance characteristics.

Instead, results are associated with their execution environment.

Example:

    Machine A
        Baseline: 800 TPS
        Optimized: 960 TPS
        Improvement: +20%

    Machine B
        Baseline: 1200 TPS
        Optimized: 1440 TPS
        Improvement: +20%

The absolute TPS values remain machine-specific.

Relative changes such as percentage improvement may be compared across
machines when the same workload, experimental procedure, and optimization
are used.

However, such cross-machine comparisons must still identify the hardware
environment and must not be presented as a single universal performance
measurement.

---

## 4. Directory Structure for Benchmark Results

Benchmark definitions are shared across the project.

Results are associated with the machine/environment on which they were
generated.

A benchmark may therefore use a structure such as:

    benchmarks/
    ├── sysbench/
    │   ├── README.md
    │   ├── scripts/
    │   └── configs/
    │
    ├── tpch/
    │   └── README.md
    │
    ├── job/
    │   └── README.md
    │
    └── tpcds/
        └── README.md

Raw experiment results are stored separately:

    results/
    ├── machine-a/
    │   ├── environment.json
    │   ├── sysbench/
    │   ├── tpch/
    │   ├── job/
    │   └── tpcds/
    │
    └── machine-b/
        ├── environment.json
        ├── sysbench/
        ├── tpch/
        ├── job/
        └── tpcds/

Each machine/environment has an environment description associated with it.

---

## 5. Official vs Development Results

Results are classified as:

### Development

Used to verify that:
- workloads execute correctly,
- scripts work,
- PostgreSQL configuration changes are valid,
- and AgentDB components behave correctly.

Development results do not form the final performance claims.

### Official

Generated using the canonical evaluation environment and the approved
benchmark protocol.

Only official results are used for the primary performance evaluation of
AgentDB.

---

## 6. Baseline and Optimization Comparisons

Every optimization experiment follows a controlled before/after procedure.

    Baseline
       |
       v
    Collect metrics
       |
       v
    AgentDB analyzes workload
       |
       v
    Optimization proposal
       |
       v
    Validation
       |
       v
    Apply optimization
       |
       v
    Run identical workload
       |
       v
    Collect metrics
       |
       v
    Compare baseline vs optimized

The following should remain unchanged between the baseline and optimized
runs unless the experiment explicitly studies that variable:

- hardware
- operating system
- PostgreSQL version
- database dataset
- dataset scale
- workload
- workload parameters
- benchmark duration
- concurrency
- measurement procedure

The optimization itself should be the controlled variable.

---

## 7. Repetitions and Variability

A single benchmark run is not considered sufficient evidence for a
performance improvement.

Experiments should be repeated to estimate normal run-to-run variability.

Where appropriate, results should report:

- mean
- median
- standard deviation
- P95 latency
- minimum
- maximum

The number of repetitions is defined separately for each workload based on
the cost and variability of the experiment.

---

## 8. Benchmark Metadata

Every recorded result should contain enough metadata to reproduce the
experiment.

Example:

    {
      "workload": "sysbench_oltp_read_write",
      "dataset_scale": "...",
      "threads": 8,
      "duration_seconds": 60,
      "postgres_version": "16.15",
      "sysbench_version": "1.0.20",
      "machine_id": "machine-a",
      "git_commit": "...",
      "experiment_id": "S2-8T-R1",
      "metrics": {
        "tps": 0,
        "avg_latency_ms": 0,
        "p95_latency_ms": 0
      }
    }

The exact schema may evolve as the benchmark framework is implemented.

---

## 9. Benchmark Comparability

Two results may be directly compared only when the relevant experimental
conditions are equivalent.

For example:

    Same machine
    Same workload
    Same dataset
    Same scale
    Same PostgreSQL version
    Same benchmark configuration
    Same concurrency
    Same duration
    Different optimization

is a valid baseline-vs-optimization comparison.

Different hardware environments are treated as separate experimental
environments.

---

## 10. Research Evaluation

The primary research question is not simply whether PostgreSQL can achieve
a high throughput value.

AgentDB is evaluated on whether its optimization system can identify and
apply changes that produce measurable improvements under a controlled
workload.

Therefore, evaluation focuses on:

- performance improvement,
- latency reduction,
- P95 latency,
- throughput,
- resource utilization,
- optimization validity,
- optimization success rate,
- and whether improvements remain consistent across repeated experiments.

The benchmark workloads provide controlled environments in which the
AgentDB optimization loop can be evaluated.
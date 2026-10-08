# Sysbench Benchmark

## 1. Overview

Sysbench is a general-purpose benchmark tool capable of generating
database workloads under controlled levels of concurrency.

AgentDB uses Sysbench primarily to evaluate PostgreSQL under transactional
(OLTP) workloads.

The Sysbench workload provides repeated database operations such as reads,
writes, inserts, updates, and deletes while allowing the number of concurrent
worker threads and other workload parameters to be controlled.

The benchmark is useful for studying how PostgreSQL responds to different
workload intensities and how database configuration and other optimizations
affect transactional performance.

---

## 2. Role in AgentDB

Sysbench is primarily used for:

- establishing a reproducible OLTP baseline,
- studying concurrency and workload scaling,
- evaluating PostgreSQL configuration changes,
- evaluating index-related optimizations where applicable,
- generating performance observations for the Configuration Expert,
- and evaluating the complete AgentDB optimization loop.

Sysbench is not intended to represent every possible database workload.

Analytical workloads are evaluated separately using TPC-H, JOB, and TPC-DS.

---

## 3. Software

The benchmark environment currently uses:

| Component | Version |
|---|---|
| PostgreSQL | 16.15 |
| Sysbench | 1.0.20 |
| Database driver | PostgreSQL / pgsql |
| AgentDB | See Git commit used for experiment |

Exact versions must be recorded with every official experiment.

---

## 4. Workload

The initial Sysbench workload is:

    oltp_read_write

This represents a mixed transactional workload containing database reads
and writes.

The workload includes operations such as:

- SELECT operations
- INSERT operations
- UPDATE operations
- DELETE operations

The workload therefore provides a mixture of read and write activity rather
than measuring a single SQL query.

---

# 5. Dataset

The Sysbench dataset is generated using Sysbench's `prepare` phase.

The dataset size must be explicitly recorded for every experiment.

The initial development configuration uses:

    tables: 4
    rows per table: 100,000

This configuration is a starting point for the benchmark environment.

The final official scale should be selected based on the available canonical
evaluation environment and documented before official measurements are
collected.

---

# 6. Metrics

The primary Sysbench metrics are:

### Transactions Per Second (TPS)

Measures the number of completed Sysbench transactions per second.

Higher throughput indicates that more transactions are being completed in
the same amount of time.

### Average Latency

Average time required to complete a transaction.

### P95 Latency

The latency below which approximately 95% of measured transactions complete.

P95 is important because average latency can hide slower requests.

### Maximum Latency

The highest observed transaction latency.

### Queries Per Second (QPS)

The number of SQL queries executed per second.

QPS is reported separately from TPS because a Sysbench transaction consists
of multiple SQL operations.

### Errors

Number of ignored or failed operations.

A benchmark with unexpected errors should not be treated as a valid
performance comparison without investigation.

---

# 7. Experiment Plan

The Sysbench experiments are divided into stages.

Each stage answers a different question.

---

# S1 — Baseline Stability

## Question

How much does the same database workload vary between repeated executions
when no intentional database or workload change is made?

The purpose of S1 is to establish the natural run-to-run variability of
the benchmark environment before evaluating any AgentDB optimization.

---

## Workload

S1 uses the Sysbench:

    oltp_read_only

workload.

A read-only workload is intentionally used for S1 so that repeated benchmark
runs do not modify the benchmark dataset. This makes the runs more directly
comparable and allows us to measure benchmark variability rather than
variability caused by progressive database mutations.

---

## Fixed Experimental Conditions

The following remain unchanged across all S1 runs:

- same physical machine
- same operating system
- same PostgreSQL instance
- same PostgreSQL configuration
- same PostgreSQL version
- same Sysbench version
- same dataset
- same dataset size
- same Sysbench workload
- same number of threads
- same benchmark duration
- same benchmark parameters
- same measurement procedure

The machine environment and runtime conditions are recorded automatically
for each experiment.

---

## Configuration

Initial S1 configuration:

| Parameter | Value |
|---|---|
| Workload | `oltp_read_only` |
| Tables | 4 |
| Rows per table | 100,000 |
| Threads | 4 |
| Measured duration | 60 seconds |
| Number of measured runs | 5 |

The configuration is intentionally fixed for S1.

Concurrency is studied separately in S2.

---

## Repetitions

Five independent measured runs are performed:

    Run 1
    Run 2
    Run 3
    Run 4
    Run 5

The benchmark is executed using the same workload and configuration for
each run.

---

## Runtime Monitoring

The benchmark runner automatically records system state before, during,
and after the benchmark.

The collected runtime information includes, where available:

- CPU utilization
- memory utilization
- system load
- available memory
- PostgreSQL container CPU utilization
- PostgreSQL container memory utilization
- PostgreSQL configuration relevant to the experiment

This information is stored together with the benchmark results so that
unusual system conditions can be identified when interpreting results.

---

## Metrics

The primary performance metrics are:

- Transactions per second (TPS)
- Queries per second (QPS)
- Average latency
- P95 latency
- Maximum latency
- Number of errors

The following summary statistics are calculated across the five runs:

- mean TPS
- TPS standard deviation
- mean average latency
- average P95 latency
- P95 latency standard deviation
- minimum and maximum observed values
- total errors

---

## Purpose

S1 establishes the natural variability of the benchmark environment.

This provides a reference against which later performance changes can be
interpreted.

For example, if an optimization appears to improve throughput by only a
small amount but the S1 runs naturally fluctuate by a similar amount, the
observed improvement may not represent a meaningful performance change.

S1 therefore provides the baseline stability information required before
conducting optimization experiments.

---

## Result Storage

Results are automatically associated with the machine on which the
experiment was executed.

Results are stored under:

    results/<machine-id>/sysbench/S1/

A typical result directory contains:

    results/
    └── <machine-id>/
        └── sysbench/
            └── S1/
                ├── experiment.json
                ├── environment.json
                ├── run_01.json
                ├── run_02.json
                ├── run_03.json
                ├── run_04.json
                ├── run_05.json
                └── summary.json

The machine fingerprint generated by the standard machine fingerprinting
procedure remains the authoritative description of the machine environment.

---

## Reproducibility

An S1 result must be reproducible using:

- the benchmark code at the recorded Git commit
- the recorded machine environment
- the recorded PostgreSQL version and configuration
- the recorded Sysbench version
- the recorded dataset configuration
- the recorded workload parameters

S1 results from different machines are not combined into a single
performance value.

Each machine has its own S1 result set.


## S2 — Concurrency Scaling

### Question

How does PostgreSQL performance change as the number of concurrent
clients increases under a fixed read-only OLTP workload?

### Method

Run the same Sysbench `oltp_read_only` workload while varying the
number of concurrent threads.

The following concurrency levels are evaluated:

    1 thread
    2 threads
    4 threads
    8 threads
    16 threads

All other workload conditions remain fixed:

- 4 tables
- 100,000 rows per table
- 60 seconds per measured run
- 3 measured runs per concurrency level

The concurrency levels are experimental conditions used to characterize
the relationship between concurrency and database performance.

### Metrics

For each concurrency level:

- TPS
- QPS
- average latency
- P95 latency
- maximum latency
- errors
- CPU utilization
- memory utilization
- PostgreSQL container resource utilization

Repeated runs are used to measure run-to-run variability.

### Expected Analysis

The resulting data characterizes the relationship between:

    concurrency -> throughput
    concurrency -> average latency
    concurrency -> P95 latency
    concurrency -> resource utilization

The results establish how the database behaves as workload concurrency
increases and provide workload-state information that can later be
used by AgentDB during optimization.

---

# S3 — Configuration Optimization

### Question

Can PostgreSQL configuration changes improve performance for a known
transactional workload?

### Baseline

Use the stable baseline configuration established during S1/S2.

### Method

    Baseline configuration
            |
            v
    Run workload
            |
            v
    Collect metrics
            |
            v
    Configuration Expert
            |
            v
    Proposed configuration
            |
            v
    Validate
            |
            v
    Apply configuration
            |
            v
    Run identical workload
            |
            v
    Compare results

Only the configuration being evaluated should change between the baseline
and optimized runs.

### Candidate Parameters

Potential parameters include:

- `shared_buffers`
- `work_mem`
- `maintenance_work_mem`
- `effective_cache_size`
- relevant planner configuration

The final parameter set will be determined during implementation.

### Metrics

- TPS
- average latency
- P95 latency
- QPS
- CPU utilization
- memory utilization
- disk I/O
- configuration values

---

# S4 — Index Optimization

### Question

Can an index-related optimization improve workload performance without
causing unacceptable overhead elsewhere?

### Method

    Baseline
       |
       v
    Workload analysis
       |
       v
    Index recommendation
       |
       v
    Validation
       |
       v
    Apply index change
       |
       v
    Repeat workload
       |
       v
    Compare

The workload, dataset, hardware, and benchmark parameters remain unchanged.

### Metrics

In addition to standard performance metrics:

- TPS
- average latency
- P95 latency
- query execution time
- query plans
- buffer/cache behavior
- index size
- write overhead where applicable

---

# S5 — AgentDB Closed-Loop Optimization

### Question

Can the complete AgentDB system autonomously identify, validate, apply,
and evaluate an optimization?

### Method

    Workload
       |
       v
    Observe
       |
       v
    Diagnose
       |
       v
    Specialized Expert(s)
       |
       v
    LLM Planner
       |
       v
    Optimization Plan
       |
       v
    Validator
       |
       v
    Executor
       |
       v
    Benchmark
       |
       v
    Measure
       |
       v
    Experience Repository

The baseline and optimized workload must use the same controlled
experimental environment.

### Evaluation

The complete system will be evaluated using:

- performance improvement,
- latency reduction,
- P95 reduction,
- throughput change,
- resource utilization,
- optimization validity,
- successful optimization rate,
- and repeatability.

---

# 8. Result Storage

Raw benchmark results should be stored separately from benchmark code.

Example:

    results/
    └── <machine-id>/
        └── sysbench/
            ├── S1/
            │   ├── run_01.json
            │   ├── run_02.json
            │   └── run_03.json
            │
            ├── S2/
            │   ├── 1_threads.json
            │   ├── 2_threads.json
            │   ├── 4_threads.json
            │   ├── 8_threads.json
            │   └── 16_threads.json
            │
            └── S3/
                ├── baseline.json
                └── optimized.json

The exact directory structure may evolve with the benchmark framework.

---

# 9. Reproducibility

Every official result must be reproducible from:

1. benchmark code,
2. workload configuration,
3. dataset generation parameters,
4. PostgreSQL version,
5. PostgreSQL configuration,
6. Sysbench version,
7. machine/environment description,
8. benchmark parameters,
9. and the AgentDB Git commit.

A benchmark result without sufficient metadata is not considered a complete
experimental result.

---

# 10. Current Development Result

The first Sysbench execution was performed as a workload smoke test.

Configuration:

    workload: oltp_read_write
    tables: 4
    rows/table: 100,000
    threads: 4
    duration: 60 seconds
    Sysbench: 1.0.20
    PostgreSQL: 16.15

Observed:

    TPS: 795.69
    QPS: 15,914.63
    Average latency: 5.02 ms
    P95 latency: 5.67 ms
    Maximum latency: 21.88 ms
    Errors: 3

This run is retained as a development/validation observation and is NOT
treated as an official performance baseline.

The official baseline will be established after the benchmarking protocol
and canonical evaluation environment have been finalized.
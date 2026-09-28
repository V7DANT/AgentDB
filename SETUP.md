# AgentDB Setup Guide

This guide prepares a machine for running AgentDB benchmarks.

## 1. Clone the Repository

### Linux / Ubuntu

Open a terminal and run:

```bash
git clone https://github.com/V7DANT/AgentDB.git
cd AgentDB
```

### Windows

AgentDB benchmarks should be run through **WSL2 + Ubuntu**.

Open PowerShell as Administrator and run:

```powershell
wsl --install
```

Restart the computer if prompted.

Open **Ubuntu** from the Start Menu and then run:

```bash
git clone https://github.com/V7DANT/AgentDB.git
cd AgentDB
```

All benchmark commands should be run inside the Ubuntu terminal.

---

## 2. Install Required Software

Run the following inside **Ubuntu / WSL2 Ubuntu**:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip git sysbench
```

Verify:

```bash
python3 --version
git --version
sysbench --version
```

---

## 3. Install Docker

### Linux / Ubuntu

Check whether Docker is already installed:

```bash
docker --version
docker compose version
```

If Docker is not installed, install Docker using the official Docker
installation instructions.

### Windows

Install **Docker Desktop** with WSL2 support.

After installation:

1. Start Docker Desktop.
2. Open Docker Desktop settings.
3. Ensure WSL2 integration is enabled for the Ubuntu distribution.
4. Open the Ubuntu terminal.

Verify:

```bash
docker --version
docker compose version
```

---

## 4. Create the Python Environment

From the AgentDB project directory:

```bash
python3 -m venv .venv
```

Activate it:

```bash
source .venv/bin/activate
```

Install the project dependencies:

```bash
pip install -r requirements.txt
```

> **Important:** Use `-r`.

---

## 5. Start PostgreSQL

AgentDB uses PostgreSQL through Docker.

From the project root:

```bash
docker compose up -d
```

Check that PostgreSQL is running:

```bash
docker compose ps
```

The `agentdb-postgres` container should have a running status.

---

## 6. Create the Machine Fingerprint

Each machine must create its own environment fingerprint before running
benchmarks.

From the project root:

```bash
./machines/fingerprint.sh
```

This creates:

```text
machines/
└── <machine-id>/
    └── environment.txt
```

The fingerprint records relevant hardware, operating system, Docker,
PostgreSQL, Sysbench, and configuration information.

Run this once when setting up a new machine.

---

## 7. Verify the Setup

Make sure the following commands work:

```bash
python --version
sysbench --version
docker --version
docker compose version
docker compose ps
```

Also verify that the machine fingerprint exists:

```bash
find machines -name environment.txt
```

---

## 8. Run a Benchmark

Once setup is complete, follow the README for the specific benchmark.

For Sysbench S1:

```bash
python benchmarks/sysbench/run_s1.py
```

The benchmark automatically stores results under:

```text
results/
└── <machine-id>/
    └── sysbench/
        └── S1/
```

Do not manually change benchmark parameters unless instructed by the
corresponding experiment README.

---

## 9. Commit and Push Results

After the benchmark completes, check the generated files:

```bash
git status
```

Add the machine information and results:

```bash
git add machines/ results/
```

Commit:

```bash
git commit -m "Add Sysbench S1 results for <machine-id>"
```

Push:

```bash
git push
```

Each machine has its own result directory, so results from different
machines remain separate.

---

## Quick Checklist

Before running a benchmark:

- [ ] Repository cloned
- [ ] Ubuntu / WSL2 Ubuntu available
- [ ] Python installed
- [ ] Virtual environment created
- [ ] `requirements.txt` installed
- [ ] Sysbench installed
- [ ] Docker installed and running
- [ ] PostgreSQL container running
- [ ] Machine fingerprint created
- [ ] Benchmark-specific README followed

Once all items are complete, the machine is ready for benchmarking.
"""Run Codex image generation jobs in parallel. Usage: python3 run_jobs.py [name ...]"""
import subprocess, sys, os, json, concurrent.futures as cf
from jobs import JOBS, JOBS2, JOBS3, JOBS4, JOBS5, JOBS6, JOBS7, JOBS8, JOBS9, JOBS10, JOBS11, JOBS12, JOBS13, JOBS14, JOBS15, JOBS16, JOBS17, JOBS18

os.makedirs("raw", exist_ok=True)
os.makedirs("logs", exist_ok=True)
only = set(sys.argv[1:])

def run(job):
    out = f"raw/{job['name']}.png"
    if os.path.exists(out) and not only:
        return job["name"], "skip"
    prompt = ("Use your image generation tool to generate exactly ONE image. " + job["prompt"] +
              f" When the image is generated, copy it to {out} (relative to the current directory) and reply with only that path.")
    cmd = ["codex", "exec", "--skip-git-repo-check", "--sandbox", "workspace-write", prompt]
    for r in job["refs"]:
        cmd += ["-i", r]
    with open(f"logs/{job['name']}.log", "w") as log:
        p = subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, timeout=900)
    return job["name"], ("ok" if os.path.exists(out) else f"missing (exit {p.returncode})")

ALL = JOBS + JOBS2 + JOBS3 + JOBS4 + JOBS5 + JOBS6 + JOBS7 + JOBS8 + JOBS9 + JOBS10 + JOBS11 + JOBS12 + JOBS13 + JOBS14 + JOBS15 + JOBS16 + JOBS17 + JOBS18
jobs = [j for j in ALL if not only or j["name"] in only]
with cf.ThreadPoolExecutor(4) as ex:
    for name, status in ex.map(run, jobs):
        print(name, status, flush=True)

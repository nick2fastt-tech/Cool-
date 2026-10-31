"""Event loop for the rest of the pipeline.
- renders 2-8 start right away (max 2 at once while separation is still running, 3 after)
- when separation ends: transcribe 9-13 and mix 9-13, then render them."""
import subprocess, time, os, sys

SP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = f'{SP}/work'
PY = f'{SP}/venv/bin/python'
S = f'{SP}/scripts'


def running(pat):
    return subprocess.run(['pgrep', '-f', pat], capture_output=True).returncode == 0


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


# don't race the remix of tracks 3/4/6/7
while running('scripts/mix.py'): time.sleep(5)
log('remix done; starting render loop')

queue = [n for n in range(2, 14) if not os.path.exists(f'{W}/video/{n:02d}.mp4')]
active = {}
tr = mx = None
while queue or active or tr is None:
    sep_running = running('scripts/separate.py')
    if not sep_running and tr is None:
        missing = [n for n in range(1, 14) if not os.path.exists(f'{W}/stems/{n:02d}_vocals.wav')]
        if missing:
            log('MISSING STEMS', missing); sys.exit(1)
        log('separation finished -> transcribe 9-13 + mix 9-13')
        tr = subprocess.Popen([PY, f'{S}/transcribe.py', W, 'large-v3-turbo', '9', '10', '11', '12', '13'],
                              stdout=open(f'{W}/transcribe_b.log', 'w'), stderr=subprocess.STDOUT)
        mx = subprocess.Popen([PY, f'{S}/mix.py', W, '9', '10', '11', '12', '13'],
                              stdout=open(f'{W}/mix_b.log', 'w'), stderr=subprocess.STDOUT)
    for n, p in list(active.items()):
        if p.poll() is not None:
            log(f'render {n:02d} exit {p.returncode}'); del active[n]
    ext = 1 if running('render.py song 1$') else 0
    maxj = 2 if sep_running else 3

    def ready(n):
        if n >= 9:
            return tr is not None and tr.poll() is not None and mx.poll() is not None
        return os.path.exists(f'{W}/master/{n:02d}.wav') and os.path.exists(f'{W}/lyrics/{n:02d}.raw.json')

    while queue and len(active) + ext < maxj and ready(queue[0]):
        n = queue.pop(0)
        subprocess.run([PY, f'{S}/build_lines.py', W, str(n)], check=True, stdout=subprocess.DEVNULL)
        active[n] = subprocess.Popen([PY, f'{S}/render.py', 'song', str(n)],
                                     stdout=open(f'{W}/render_{n:02d}.log', 'w'), stderr=subprocess.STDOUT)
        log(f'render {n:02d} started')
    time.sleep(5)
log('ALL RENDERS FINISHED')

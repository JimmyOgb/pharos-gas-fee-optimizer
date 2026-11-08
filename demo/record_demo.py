import os
import glob
import asyncio
import subprocess
from playwright.async_api import async_playwright

PROD_URL = "https://pharos-gas-fee-optimizer.vercel.app"
DEMO_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_VIDEO_DIR = os.path.join(DEMO_DIR, "raw_video")
VOICEOVER_PATH = os.path.join(DEMO_DIR, "voiceover.mp3")
SRT_PATH = os.path.join(DEMO_DIR, "narration.srt")
FINAL_MP4 = os.path.join(DEMO_DIR, "pharos-gas-fee-optimizer-demo.mp4")
CLEAN_MP4 = os.path.join(DEMO_DIR, "pharos-gas-fee-optimizer-demo-clean.mp4")

NARRATION_TEXT = (
    "Welcome to the Pharos Gas Fee Optimizer, an autonomous transaction timing sentinel on Pharos Atlantic Testnet. "
    "Requirement one: The optimizer tracks network gas prices in real time, calculating min, max, average, and observation history. "
    "Requirement two: Users can schedule non-urgent transactions with a target fee ceiling and a forced submission deadline. "
    "The deterministic decision engine holds the transaction in the queue while prevailing gas exceeds the configured ceiling. "
    "Requirement four: The optimizer never misses a deadline. At deadline expiration, it forces submission even if gas is high. "
    "Requirement three: On confirmation, it reports the actual gas paid against the initial estimate, with direct PharosScan links. "
    "Production verified and deployed on Vercel."
)

CURSOR_JS = """
() => {
  if (document.getElementById('demo-cursor')) return;
  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  Object.assign(cursor.style, {
    position: 'fixed', top: '0px', left: '0px',
    width: '20px', height: '20px',
    background: 'rgba(245, 158, 11, 0.9)',
    border: '2px solid white', borderRadius: '50%',
    boxShadow: '0 0 15px rgba(245, 158, 11, 0.8)',
    pointerEvents: 'none', zIndex: '999999',
    transition: 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
    transform: 'translate(-50%, -50%)'
  });
  document.body.appendChild(cursor);

  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
  document.addEventListener('mousedown', e => {
    cursor.style.transform = 'translate(-50%, -50%) scale(0.7)';
    const ripple = document.createElement('div');
    Object.assign(ripple.style, {
      position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px',
      width: '10px', height: '10px', borderRadius: '50%',
      border: '2px solid rgba(245, 158, 11, 0.95)',
      transform: 'translate(-50%, -50%) scale(1)',
      opacity: '1', pointerEvents: 'none', zIndex: '999998',
      transition: 'all 0.4s ease-out'
    });
    document.body.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transform = 'translate(-50%, -50%) scale(4)';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 400);
  });
  document.addEventListener('mouseup', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(1)';
  });
}
"""

async def generate_voiceover():
    print("[Voiceover] Generating narration using edge-tts...")
    try:
        import edge_tts
        communicate = edge_tts.Communicate(NARRATION_TEXT, "en-US-ChristopherNeural")
        await communicate.save(VOICEOVER_PATH)
        print("[Voiceover] Saved to:", VOICEOVER_PATH)
    except Exception as e:
        print("[Voiceover] edge-tts error, falling back to powershell SAPI:", e)
        escaped = NARRATION_TEXT.replace('"', '`"')
        cmd = f'pwsh -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile(\'{VOICEOVER_PATH}\'); $s.Speak(\'{escaped}\'); $s.Dispose()"'
        subprocess.run(cmd, shell=True, check=True)

async def smooth_move(page, target_x, target_y, steps=25):
    await page.mouse.move(target_x, target_y, steps=steps)
    await asyncio.sleep(0.1)

async def smooth_click(page, selector: str, pause_after: float = 1.5):
    loc = page.locator(selector).first
    await loc.wait_for(state="visible", timeout=12000)
    await loc.scroll_into_view_if_needed()
    box = await loc.bounding_box()
    if box:
        target_x = box["x"] + box["width"] / 2
        target_y = box["y"] + box["height"] / 2
        await smooth_move(page, target_x, target_y, steps=25)
        await asyncio.sleep(0.2)
        await page.mouse.click(target_x, target_y)
    else:
        await loc.click()
    await asyncio.sleep(pause_after)

async def smooth_type(page, selector: str, text: str, pause_after: float = 1.0):
    await smooth_click(page, selector, pause_after=0.2)
    await page.locator(selector).first.fill("")
    await page.keyboard.type(text, delay=40)
    await asyncio.sleep(pause_after)

async def record_walkthrough():
    os.makedirs(RAW_VIDEO_DIR, exist_ok=True)
    for f in glob.glob(os.path.join(RAW_VIDEO_DIR, "*")):
        try: os.remove(f)
        except: pass

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=RAW_VIDEO_DIR,
            record_video_size={"width": 1920, "height": 1080}
        )
        page = await context.new_page()

        print("[Browser] Navigating to production app:", PROD_URL)
        await page.goto(PROD_URL, wait_until="networkidle")
        await page.evaluate(CURSOR_JS)
        await asyncio.sleep(2.0)

        # 1. Hover top status bar (Pharos Atlantic & MCP status)
        print("[Walkthrough] Hovering top status strip...")
        await smooth_move(page, 1500, 35, steps=30)
        await asyncio.sleep(2.0)

        # 2. Hover over gas metrics (Req 01)
        print("[Walkthrough] Showcasing gas metrics row (Req 01)...")
        await smooth_move(page, 400, 160, steps=25)
        await asyncio.sleep(1.5)
        await smooth_move(page, 800, 160, steps=25)
        await asyncio.sleep(1.5)

        # 3. Fill scheduling form (Req 02)
        print("[Walkthrough] Filling transaction intent form (Req 02)...")
        await smooth_type(page, "#inputRecipient", "0x6960d708304918e9d9e487146522c0db35a5078a", pause_after=0.5)
        await smooth_type(page, "#inputAmount", "0.05", pause_after=0.5)
        await smooth_type(page, "#inputTargetGas", "7.0", pause_after=0.5)
        await smooth_type(page, "#inputDeadline", "18", pause_after=0.8)

        # 4. Click Submit Intent
        print("[Walkthrough] Scheduling intent into durable queue...")
        await smooth_click(page, "#btnSubmitIntent", pause_after=2.5)

        # 5. Scroll down to Queue and observe countdown (Req 02 & 04)
        print("[Walkthrough] Inspecting active queue card...")
        await smooth_move(page, 960, 680, steps=25)
        await asyncio.sleep(3.0)

        # 6. Click Force Watchdog Tick to advance deadline (Req 04)
        print("[Walkthrough] Forcing watchdog evaluation at deadline (Req 04)...")
        await smooth_click(page, "#btnForceWatchdogTick", pause_after=3.5)

        # 7. Hover over confirmed/elevated card with fee comparison (Req 03)
        print("[Walkthrough] Inspecting fee comparison and PharosScan link (Req 03)...")
        await smooth_move(page, 960, 750, steps=25)
        await asyncio.sleep(4.0)

        # 8. Inspect recent gas history stream
        print("[Walkthrough] Inspecting gas history table...")
        await smooth_move(page, 1300, 380, steps=25)
        await asyncio.sleep(3.0)

        await context.close()
        await browser.close()
        print("[Browser] Recording finalized.")

def merge_video():
    raw_files = glob.glob(os.path.join(RAW_VIDEO_DIR, "*.webm"))
    if not raw_files:
        raise RuntimeError("No raw webm recording found!")
    raw_webm = raw_files[0]
    print("[FFmpeg] Merging video with audio...", raw_webm)

    # 1. Clean MP4
    cmd_clean = [
        "ffmpeg", "-y",
        "-i", raw_webm,
        "-i", VOICEOVER_PATH,
        "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-r", "30",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        CLEAN_MP4
    ]
    subprocess.run(cmd_clean, check=True)
    print("[FFmpeg] Clean MP4 created:", CLEAN_MP4)

    # 2. Subtitled MP4
    escaped_srt = SRT_PATH.replace("\\", "/").replace(":", "\\:")
    cmd_sub = [
        "ffmpeg", "-y",
        "-i", raw_webm,
        "-i", VOICEOVER_PATH,
        "-vf", f"subtitles='{escaped_srt}':force_style='FontSize=20,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=4,Outline=1'",
        "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-r", "30",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        FINAL_MP4
    ]
    try:
        subprocess.run(cmd_sub, check=True)
        print("[FFmpeg] Subtitled MP4 created:", FINAL_MP4)
    except Exception as e:
        print("[FFmpeg] Subtitle overlay failed, copying clean as final:", e)
        import shutil
        shutil.copyfile(CLEAN_MP4, FINAL_MP4)

async def main():
    await generate_voiceover()
    await record_walkthrough()
    merge_video()
    print("=== DEMO VIDEO COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(main())

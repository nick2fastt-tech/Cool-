import torch, numpy as np, time
from PIL import Image
from spandrel import ModelLoader
torch.set_num_threads(4)
m = ModelLoader().load_from_file('models/RealESRGAN_x4plus.pth').eval()
img = np.asarray(Image.open('design/cover.jpg').convert('RGB')).astype(np.float32) / 255.
H, W, _ = img.shape
S = m.scale
out = np.zeros((H*S, W*S, 3), np.float32)
T, P = 256, 16
t0 = time.time()
with torch.no_grad():
    for y in range(0, H, T):
        for x in range(0, W, T):
            y0, x0 = max(y-P, 0), max(x-P, 0)
            y1, x1 = min(y+T+P, H), min(x+T+P, W)
            tile = torch.from_numpy(img[y0:y1, x0:x1].transpose(2, 0, 1)[None].copy())
            r = m(tile)[0].numpy().transpose(1, 2, 0)
            ty0, tx0 = (y-y0)*S, (x-x0)*S
            th, tw = (min(y+T, H)-y)*S, (min(x+T, W)-x)*S
            out[y*S:y*S+th, x*S:x*S+tw] = r[ty0:ty0+th, tx0:tx0+tw]
print('upscaled in', round(time.time()-t0, 1), 's ->', out.shape)
Image.fromarray((np.clip(out, 0, 1)*255+0.5).astype(np.uint8)).save('design/cover_x4.png')

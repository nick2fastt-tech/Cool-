import numpy as np, onnxruntime as ort
from PIL import Image
img = Image.open('design/cover.jpg').convert('RGB')
box = (40, 300, 860, 768)
crop = img.crop(box)
sess = ort.InferenceSession('models/isnet-general-use.onnx', providers=['CPUExecutionProvider'])
a = np.asarray(crop.resize((1024, 1024), Image.LANCZOS)).astype(np.float32)
a = a / a.max()
a = ((a - np.array([0.485, 0.456, 0.406])) / 1.0).transpose(2, 0, 1)[None].astype(np.float32)
p = sess.run(None, {sess.get_inputs()[0].name: a})[0][0, 0]
p = (p - p.min()) / (p.max() - p.min())
m = np.asarray(Image.fromarray((p * 255).astype(np.uint8)).resize(crop.size, Image.BILINEAR))
full = np.zeros((img.size[1], img.size[0]), np.uint8)
full[box[1]:box[3], box[0]:box[2]] = m
Image.fromarray(full).save('design/person_mask_isnet.png')
prev = np.asarray(img).astype(np.float32)
f = full[..., None] / 255.
prev = prev * (1 - 0.6 * f) + np.array([0, 150, 255]) * 0.6 * f
Image.fromarray(np.clip(prev, 0, 255).astype(np.uint8)).crop(box).save('design/mask_preview_isnet.png')
print('ok')

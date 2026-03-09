from PIL import Image, ImageDraw

img = Image.open("icon.jpg")
# 转换为RGBA模式
img = img.convert("RGBA")
img.save("icon.png")
# 查看图片是RGB还是RGBA
print(img.mode)
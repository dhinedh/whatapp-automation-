import os
from PIL import Image

def make_square_logo():
    src_path = os.path.join(os.path.dirname(__file__), 'public', 'logo.png')
    img = Image.open(src_path).convert('RGBA')
    
    w, h = img.size
    print(f"Original size: {w}x{h}")
    
    # Target size: 640x640 (Official WhatsApp Business Profile DP specification)
    target_size = 640
    
    # Create white background canvas
    background = Image.new('RGBA', (target_size, target_size), (255, 255, 255, 255))
    
    # Calculate scale factor to fit within 560x560 (leaving 40px margin around edges)
    max_inner_size = 560
    ratio = min(max_inner_size / w, max_inner_size / h)
    new_w = int(w * ratio)
    new_h = int(h * ratio)
    
    resized_img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Paste centered
    offset_x = (target_size - new_w) // 2
    offset_y = (target_size - new_h) // 2
    
    background.paste(resized_img, (offset_x, offset_y), resized_img)
    
    # Save as square PNG and square JPG
    out_png = os.path.join(os.path.dirname(__file__), 'public', 'logo_dp.png')
    out_jpg = os.path.join(os.path.dirname(__file__), 'public', 'logo_dp.jpg')
    out_logo_png = os.path.join(os.path.dirname(__file__), 'public', 'logo.png')
    
    background.save(out_png, 'PNG')
    background.convert('RGB').save(out_jpg, 'JPEG', quality=95)
    background.save(out_logo_png, 'PNG')
    
    print(f"Saved 640x640 square logo to:")
    print(f" - {out_png}")
    print(f" - {out_jpg}")
    
    # Also copy to frontend public and src/assets
    frontend_pub = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'logo.png'))
    frontend_assets = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'assets', 'logo.png'))
    
    background.save(frontend_pub, 'PNG')
    background.save(frontend_assets, 'PNG')
    print("Updated frontend logo assets!")

if __name__ == '__main__':
    make_square_logo()

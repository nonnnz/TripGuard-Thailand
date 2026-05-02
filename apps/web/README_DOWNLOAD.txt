Run this after extracting picture.zip if images are not included:

pip install requests pillow
python download_place_images.py

It downloads each originalThumbnailUrl, converts it to JPG, saves to public/place/<id>.jpg, and keeps thumbnailUrl as public/place/<id>.jpg.

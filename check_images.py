import xml.etree.ElementTree as ET
import os

def check_images(file_path):
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        missing_images = []
        empty_images = []
        
        for sim in root.findall('simulation'):
            sim_id = sim.find('id').text.strip() if sim.find('id') is not None else "unknown"
            image = sim.find('image')
            
            if image is None:
                missing_images.append(sim_id)
            elif not image.text or not image.text.strip():
                empty_images.append(sim_id)
                
        print(f"Total simulations: {len(root.findall('simulation'))}")
        print(f"Missing image tags: {len(missing_images)}")
        if missing_images:
            print(f"IDs: {', '.join(missing_images)}")
            
        print(f"Empty image tags: {len(empty_images)}")
        if empty_images:
            print(f"IDs: {', '.join(empty_images)}")
            
    except Exception as e:
        print(f"Error parsing XML: {e}")

check_images('/Users/tansk/SengKwang/Coding/Simulations Website/data/simulations.xml')

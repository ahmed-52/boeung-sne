import re
from datetime import datetime, timedelta

def test_parsing(filename):
    print(f"Testing: {filename}")
    pattern = r"_(\d{8})_(\d{6})\((.*?)\)\.wav$"
    match = re.search(pattern, filename)
    
    if match:
        date_str = match.group(1)
        time_str = match.group(2)
        tz_str = match.group(3) # e.g. "UTC+7" or "+0700"
        
        print(f"  Match: Date={date_str}, Time={time_str}, TZ={tz_str}")
        
        try:
            # 1. Parse base time
            dt_naive = datetime.strptime(f"{date_str}{time_str}", "%Y%m%d%H%M%S")
            
            # 2. Handle Timezone
            tz_offset = timedelta(0)
            
            # Case 1: "UTC+7", "UTC-5"
            if "UTC" in tz_str:
                offset_part = tz_str.replace("UTC", "")
                try:
                    offset_hours = int(offset_part)
                    tz_offset = timedelta(hours=offset_hours)
                except ValueError:
                    print(f"  Could not parse UTC offset from {tz_str}")
            
            # Case 2: "+0700", "-0500"
            elif len(tz_str) == 5 and (tz_str.startswith("+") or tz_str.startswith("-")):
                try:
                    hours = int(tz_str[0:3])
                    minutes = int(tz_str[0] + tz_str[3:5]) # apply sign
                    tz_offset = timedelta(hours=hours, minutes=minutes)
                except ValueError:
                    print(f"  Could not parse numeric offset from {tz_str}")
            else:
                 print(f"  Unknown timezone format: {tz_str}")

            recording_start_time = dt_naive - tz_offset
            print(f"  Naive Time (Local): {dt_naive}")
            print(f"  Calculated UTC Time: {recording_start_time}")
            
        except ValueError as e:
            print(f"  Date parsing failed: {e}")
    else:
        print(f"  NO MATCH found.")
    print("-" * 20)

filenames = [
    "1_S7899_20250204_004500(UTC+7).wav",
    "5_S7903_20250205_060000(+0700).wav",
    "5_S7903_20250205_063000(+0700).wav",
    "invalid_format.wav",
    "prefix_20230101_120000(UTC-5).wav"
]

for f in filenames:
    test_parsing(f)

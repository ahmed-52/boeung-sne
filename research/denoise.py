# import noisereduce as nr
# import soundfile as sf

# data, rate = sf.read("test_30sec.wav")
# reduced = nr.reduce_noise(y=data, sr=rate)
# sf.write("clean_birds.wav", reduced, rate)

# import librosa
# y, sr = librosa.load("data/23db/3_S7901_20250204_070000(UTC+7).wav", sr=None)
# print(f"Sample rate: {sr} Hz")
# print(f"Duration: {len(y)/sr:.2f} seconds")
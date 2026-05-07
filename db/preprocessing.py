import pandas as pd
import re
import unicodedata
import ast

# Load Data
df_billboard = pd.read_csv('data/charts.csv')
df_spotify = pd.read_csv('data/tracks.csv')
df_artists = pd.read_csv('data/artists.csv')


# Helper Functions
def normalize_text(text):
    if pd.isna(text):
        return ""
    
    text = str(text)
    text = text.replace('Ø', 'O').replace('ø', 'o')
    
    # Remove accents/diacritics
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    
    text = text.lower()
    text = text.replace('$', 's')
    text = text.replace("'", "").replace("’", "").replace(".", "")
    
    # Replace all other punctuation with a SPACE
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'\bpt\b', 'part', text)
    text = re.sub(r'\bpart i\b', 'part 1', text)
    text = re.sub(r'\bpart ii\b', 'part 2', text)
    text = re.sub(r'\bpart iii\b', 'part 3', text)
    
    return text

def is_artist_match(row):
    # If either artist is missing, fail the match
    if pd.isna(row['match_artist_x']) or pd.isna(row['match_artist_y']):
        return False
        
    set_x = set(str(row['match_artist_x']).split())
    set_y = set(str(row['match_artist_y']).split())
    
    # Return True if either set is a complete subset of the other
    return set_x.issubset(set_y) or set_y.issubset(set_x)

# Spotify Preprocessing
print("Preprocessing Spotify data")

# Convert booleans for database semantics
df_spotify['explicit'] = df_spotify['explicit'].astype(bool)
df_spotify.rename(columns={'mode': 'is_major'}, inplace=True)
df_spotify['is_major'] = df_spotify['is_major'].astype(bool)

# Normalize Titles
df_spotify['name'] = df_spotify['name'].str.replace(r'\s*\(.*?\)', '', regex=True)
df_spotify['name'] = df_spotify['name'].str.split(' - ').str[0]
df_spotify['name'] = df_spotify['name'].str.split('/').str[0]
df_spotify['name'] = df_spotify['name'].str.replace(r'(?i)\s*-\s*(remix|mix|edit|radio edit|remaster|version|from\b|music from|soundtrack).*', '', regex=True)
df_spotify['match_song'] = df_spotify['name'].apply(normalize_text)

# Normalize Artists
df_spotify['match_artist'] = df_spotify['artists'].apply(normalize_text)

# Deduplicate Tracks
df_spotify.sort_values(by='popularity', ascending=False, inplace=True)
spotify_master_tracks = df_spotify.drop_duplicates(subset=['match_song', 'match_artist'], keep='first').copy()


# Billboard Preprocessing
print("Preprocessing Billboard data")

df_billboard['date'] = pd.to_datetime(df_billboard['date'])

# Normalize Titles
df_billboard['match_song'] = df_billboard['song'].str.replace(r'\s*\(.*?\)', '', regex=True)
df_billboard['match_song'] = df_billboard['match_song'].str.split(' - ').str[0]
df_billboard['match_song'] = df_billboard['match_song'].str.split('/').str[0]
df_billboard['match_song'] = df_billboard['match_song'].apply(normalize_text)

# Normalize Artists
df_billboard['match_artist'] = df_billboard['artist'].str.replace(r'(?i)\b(featuring|feat|ft|and|with)\b', ' ', regex=True)
df_billboard['match_artist'] = df_billboard['match_artist'].apply(normalize_text)


# Entity Resolution
# Check Duplicate Names (Same Title) in Spotify
duplicate_titles = df_spotify['match_song'].value_counts()
duplicate_titles_count = duplicate_titles[duplicate_titles > 1]
print(f"\nFound {len(duplicate_titles_count)} song titles that appear multiple times in Spotify.")

print("\nPerforming Entity Resolution Join")

# Merge every possible combination of artists that share the exact same normalized song title
merged_df = pd.merge(
    df_billboard, 
    spotify_master_tracks, 
    on='match_song', 
    how='left'
)

# Apply the bi-directional subset logic to drop the false positives
merged_df['is_valid_match'] = merged_df.apply(is_artist_match, axis=1)

# Keep only valid matches and clean up columns
matched_df = merged_df[merged_df['is_valid_match'] == True].copy()
matched_df.drop(columns=['match_artist_y', 'is_valid_match'], inplace=True)
matched_df.rename(columns={'match_artist_x': 'match_artist'}, inplace=True)

print(f"\nSuccessfully matched {len(matched_df)} rows")

# Unmatched Billboard Songs Analysis

# Check if any Billboard songs are not in Spotify
matched_billboard_combos = matched_df[['match_song', 'match_artist']].drop_duplicates()

missing_check_df = pd.merge(
    df_billboard,
    matched_billboard_combos,
    on=['match_song', 'match_artist'],
    how='left',
    indicator=True
)

# Filter down to the rows that failed to find a match
billboard_only = missing_check_df[missing_check_df['_merge'] == 'left_only'].copy()

billboard_missing_count = len(billboard_only)
total_billboard = len(df_billboard)
missing_percentage = (billboard_missing_count / total_billboard) * 100

print(f"\nBillboard songs missing from Spotify: {billboard_missing_count} out of {total_billboard} ({missing_percentage:.2f}%)")

# Show a clean sample of the missing songs
if billboard_missing_count > 0:
    unique_missing = billboard_only[['date', 'song', 'artist', 'match_song', 'match_artist', 'peak-rank', 'weeks-on-board']].copy()
    
    # Filter to recent songs and sort by highest peak
    unique_missing = unique_missing[unique_missing['date'] <= '2021-04-09'] 
    #unique_missing = unique_missing.sort_values(by=['peak-rank', 'weeks-on-board'], ascending=[True, False])
    unique_missing = unique_missing.drop_duplicates(subset=['match_song', 'match_artist'], keep='first')
    
    print("\nSample of Unmatched Billboard Songs (Sorted by Peak Rank):")
    pd.set_option('display.max_rows', 500)
    print(unique_missing[['peak-rank', 'weeks-on-board', 'song', 'artist']].head(100))
    print(f"\nTotal unique missing songs in this filtered timeframe: {len(unique_missing)}")

# Relational Database Preparation
print("\nStructuring data for database schema")

# TRACKS TABLE
db_tracks_raw = spotify_master_tracks[['id', 'name', 'duration_ms', 'time_signature', 
                            'key', 'tempo', 'is_major', 'explicit', 'popularity', 
                            'instrumentalness', 'speechiness', 'danceability', 
                            'acousticness', 'loudness', 'liveness', 'valence', 'energy', 'id_artists']].copy()

# Map Spotify's string IDs to clean Integer IDs (1, 2, 3...)
db_tracks_raw['track_id'] = range(1, len(db_tracks_raw) + 1)

# Format to your exact SQL schema
db_tracks_raw['mode'] = db_tracks_raw['is_major'].astype(int)
db_tracks_raw.rename(columns={'name': 'track_name'}, inplace=True)

db_tracks_final = db_tracks_raw[['track_id', 'track_name', 'duration_ms', 'time_signature', 
                                 'key', 'tempo', 'mode', 'explicit', 'popularity', 
                                 'instrumentalness', 'speechiness', 'danceability', 
                                 'acousticness', 'loudness', 'liveness', 'valence', 'energy']]

# 2. TRACK_ARTISTS TABLE (The Junction Table)
track_artists_list = []
unique_spotify_artist_ids = set()

# Loop through ALL Spotify tracks to unpack the 'id_artists' array
for _, row in db_tracks_raw.iterrows():
    t_id = row['track_id']
    try:
        # Safely evaluate the stringified list: "['artist_1', 'artist_2']" -> ['artist_1', 'artist_2']
        artist_ids = ast.literal_eval(row['id_artists'])
        for i, a_id in enumerate(artist_ids):
            unique_spotify_artist_ids.add(a_id)
            track_artists_list.append({
                'track_id': t_id,
                'spotify_artist_id': a_id,
                'is_primary': True if i == 0 else False # First artist in array is primary
            })
    except:
        pass
        
df_track_artists_raw = pd.DataFrame(track_artists_list)

# 3. ARTISTS TABLE
# Filter the loaded artists.csv to ONLY include artists present in our Spotify master list
db_artists_filtered = df_artists[df_artists['id'].isin(unique_spotify_artist_ids)].copy()

# Map Spotify's string Artist IDs to clean Integer IDs
db_artists_filtered['artist_id'] = range(1, len(db_artists_filtered) + 1)

db_artists_final = db_artists_filtered[['artist_id', 'name', 'followers', 'genres', 'popularity']].rename(columns={'name': 'artist_name'})

# Map the new Integer artist_id back to our Track_Artists junction table
db_track_artists_final = pd.merge(
    df_track_artists_raw, 
    db_artists_filtered[['id', 'artist_id']], 
    left_on='spotify_artist_id', 
    right_on='id', 
    how='inner'
)
db_track_artists_final = db_track_artists_final[['track_id', 'artist_id', 'is_primary']]

# CHART_PERFORMANCE TABLE
db_chart_performance = pd.merge(
    matched_df, 
    db_tracks_raw[['id', 'track_id']], 
    on='id', 
    how='inner'
)

# Map to your exact schema column names
db_chart_performance.rename(columns={
    'date': 'week_date',
    'rank': 'current_rank',
    'peak-rank': 'peak_rank',
    'weeks-on-board': 'weeks_on_chart'
}, inplace=True)

db_chart_performance_final = db_chart_performance[['track_id', 'week_date', 'current_rank', 'peak_rank', 'weeks_on_chart']]

# 5. Export to Schema-Compliant CSVs
print(f"Exporting CSVs (Total Tracks: {len(db_tracks_final)})...")
db_artists_final.to_csv('Artists.csv', index=False)
db_tracks_final.to_csv('Tracks.csv', index=False)
db_track_artists_final.to_csv('Track_Artists.csv', index=False)
db_chart_performance_final.to_csv('Chart_Performance.csv', index=False)
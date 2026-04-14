import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TrackPage } from './TrackPage.jsx';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    searchTracks: vi.fn(),
    getTrack: vi.fn(),
  },
}));

function renderAt(id) {
  return render(
    <MemoryRouter initialEntries={[`/track/${id}`]}>
      <Routes>
        <Route path="/track/:id" element={<TrackPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  api.getTrack.mockReset();
});

describe('TrackPage', () => {
  it('renders track details once the api resolves', async () => {
    api.getTrack.mockResolvedValue({
      track_id: 42,
      track_name: 'Shape of You',
      artist_name: 'Ed Sheeran',
      danceability: 0.825,
      energy: 0.652,
    });

    renderAt(42);

    expect(
      await screen.findByRole('heading', { name: 'Shape of You' })
    ).toBeInTheDocument();
    expect(screen.getByText(/by Ed Sheeran/)).toBeInTheDocument();
    expect(api.getTrack).toHaveBeenCalledWith('42');
  });

  it('renders an error message when the api rejects', async () => {
    api.getTrack.mockRejectedValue(new Error('not found'));
    renderAt(9999);
    expect(await screen.findByText(/track not found/i)).toBeInTheDocument();
  });
});

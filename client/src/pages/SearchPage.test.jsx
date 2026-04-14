import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SearchPage } from './SearchPage.jsx';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    searchTracks: vi.fn(),
    getTrack: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SearchPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  api.searchTracks.mockReset();
});

describe('SearchPage', () => {
  it('renders the search input and no results initially', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/blinding lights/i)).toBeInTheDocument();
    expect(api.searchTracks).not.toHaveBeenCalled();
  });

  it('calls the api after typing and renders the results as links', async () => {
    api.searchTracks.mockResolvedValue([
      { track_id: 1, track_name: 'Blinding Lights', popularity: 95 },
      { track_id: 2, track_name: 'Blinding Lights - Remix', popularity: 70 },
    ]);

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText(/blinding lights/i), 'blinding');

    await waitFor(() => {
      expect(api.searchTracks).toHaveBeenCalledWith('blinding');
    });

    const link1 = await screen.findByRole('link', { name: 'Blinding Lights' });
    expect(link1).toHaveAttribute('href', '/track/1');
    expect(
      screen.getByRole('link', { name: 'Blinding Lights - Remix' })
    ).toHaveAttribute('href', '/track/2');
    expect(screen.getByText('pop 95')).toBeInTheDocument();
  });

  it('shows an error message when the api rejects', async () => {
    api.searchTracks.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText(/blinding lights/i), 'x');

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});

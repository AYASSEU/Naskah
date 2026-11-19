import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureDocker } from '../scripts/lib/docker.mjs';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));
const command = vi.mocked(spawnSync);
const result = (status: number) => ({
  status,
  stdout: '',
  stderr: '',
  pid: 1,
  output: [],
  signal: null,
});

beforeEach(() => {
  command.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('Docker startup', () => {
  it('keeps an available engine running without restarting Docker Desktop', () => {
    command.mockReturnValue(result(0));
    ensureDocker();
    expect(command).toHaveBeenCalledTimes(1);
    expect(command.mock.calls[0]![1]).toEqual(['info', '--format', '{{.ServerVersion}}']);
  });

  it('starts Docker Desktop and verifies the engine before continuing', () => {
    command
      .mockReturnValueOnce(result(1))
      .mockReturnValueOnce(result(0))
      .mockReturnValueOnce(result(0));
    ensureDocker();
    expect(command.mock.calls.map((call) => call[1])).toEqual([
      ['info', '--format', '{{.ServerVersion}}'],
      ['desktop', 'start', '--timeout', '180'],
      ['info', '--format', '{{.ServerVersion}}'],
    ]);
  });

  it('explains a missing Docker installation without attempting to continue', () => {
    command.mockReturnValue({
      ...result(1),
      error: Object.assign(new Error(), { code: 'ENOENT' }),
    });
    expect(ensureDocker).toThrow('Docker Desktop belum terpasang');
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('stops startup when Docker Desktop cannot start or its engine stays unavailable', () => {
    command.mockReturnValueOnce(result(1)).mockReturnValueOnce(result(1));
    expect(ensureDocker).toThrow('Docker Desktop gagal dimulai');
    command.mockReset();
    command
      .mockReturnValueOnce(result(1))
      .mockReturnValueOnce(result(0))
      .mockReturnValueOnce(result(1));
    expect(ensureDocker).toThrow('Engine Docker belum siap');
  });
});

import { createThrottle } from "./throttle";

describe("createThrottle", () => {
  it("does not delay the first call", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const now = jest.fn().mockReturnValue(1000);
    const throttled = createThrottle(1000, { sleep, now });

    await throttled(() => Promise.resolve("a"));

    expect(sleep).not.toHaveBeenCalled();
  });

  it("waits out the remaining interval before a call that comes too soon", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    let currentTime = 1000;
    const now = jest.fn(() => currentTime);
    const throttled = createThrottle(1000, { sleep, now });

    await throttled(() => Promise.resolve("a"));
    currentTime = 1300;
    await throttled(() => Promise.resolve("b"));

    expect(sleep).toHaveBeenCalledWith(700);
  });

  it("does not wait if enough time has already passed", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    let currentTime = 1000;
    const now = jest.fn(() => currentTime);
    const throttled = createThrottle(1000, { sleep, now });

    await throttled(() => Promise.resolve("a"));
    currentTime = 3000;
    await throttled(() => Promise.resolve("b"));

    expect(sleep).not.toHaveBeenCalled();
  });

  it("runs calls in the order they were scheduled", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const now = jest.fn().mockReturnValue(1000);
    const throttled = createThrottle(1000, { sleep, now });
    const order: string[] = [];

    const p1 = throttled(async () => {
      order.push("a");
    });
    const p2 = throttled(async () => {
      order.push("b");
    });
    await Promise.all([p1, p2]);

    expect(order).toEqual(["a", "b"]);
  });

  it("continues processing later calls even if an earlier one rejects", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const now = jest.fn().mockReturnValue(1000);
    const throttled = createThrottle(1000, { sleep, now });

    await expect(
      throttled(() => Promise.reject(new Error("boom")))
    ).rejects.toThrow("boom");
    await expect(throttled(() => Promise.resolve("ok"))).resolves.toBe("ok");
  });
});

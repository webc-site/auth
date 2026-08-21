const DAY = 864e5,
  loop = () => {
    TODAY = Math.floor(Date.now() / DAY);
    setTimeout(loop, DAY - (Date.now() % DAY) + 100).unref();
  };

export let TODAY;
loop();

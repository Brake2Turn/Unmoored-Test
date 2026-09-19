module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo already wires up the Reanimated plugin.
  return { presets: ['babel-preset-expo'] };
};

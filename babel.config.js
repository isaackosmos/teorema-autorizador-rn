module.exports = function (api) {
  api.cache(true);

  return {
    // `babel-preset-expo` já injeta o plugin do react-native-worklets
    // (Reanimated 4) quando o pacote está instalado — não adicionar à mão.
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};

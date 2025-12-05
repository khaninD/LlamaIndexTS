import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  target: "node", // Важно для Node.js приложений
  mode: "production", // или 'development'
  entry: {
    server: "./mcp/pg-server.ts",
    client: "./mcp/llama-client.ts",
    "foreign-pg-mcp": "./mcp/pg-foreign-mcp.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].bundle.js", // [name] заменится на ключ из entry
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".js", ".json"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    // Нативные модули и модули с системными зависимостями
    pg: "commonjs pg",
    "pg-native": "commonjs pg-native",
    // Стандартные node.js модули
    net: "commonjs net",
    tls: "commonjs tls",
    dns: "commonjs dns",
    fs: "commonjs fs",
    path: "commonjs path",
    os: "commonjs os",
    crypto: "commonjs crypto",
  },
  optimization: {
    minimize: false, // Отключаем минификацию для отладки
  },
  node: {
    __dirname: false, // Сохраняем оригинальное поведение __dirname
    __filename: false, // Сохраняем оригинальное поведение __filename
  },
};

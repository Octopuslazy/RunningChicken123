const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: './src/main.ts',
    devtool: false, 

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        clean: true,
        publicPath: './'
    },
    

    resolve: {
        extensions: ['.ts', '.js', '.mjs', '.json'],
    },

    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.mjs$/,
                include: /node_modules/,
                type: 'javascript/auto',
                resolve: { fullySpecified: false }
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif|json|txt|pac|mp3|wav|ogg|ttf)$/i,
                type: 'asset/inline',
            },
            {
                test: /\.atlas$/i,
                type: 'asset/inline',
                generator: {
                    dataUrl: {
                        mimetype: 'text/plain' // Báo cho Webpack biết đây là file văn bản
                    }
                }
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, './src/index.html'),
            filename: 'index.html',
            inject: 'body',
            minify: false 
        }),
        
        new HtmlInlineScriptPlugin(),
        new webpack.optimize.LimitChunkCountPlugin({
            maxChunks: 1,
        }),
    ],

    performance: {
        hints: false,
    },
};
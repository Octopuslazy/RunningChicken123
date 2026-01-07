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
        alias: {
            // Replace fetch with polyfill
            // This might not work for all cases as fetch is a global
        },
        fallback: {
            // Provide polyfills if needed
        }
    },

    plugins: [
        new webpack.ProvidePlugin({
            // Provide global replacements - this is the key addition
        }),
        new webpack.DefinePlugin({
            // Replace fetch globally in build
            'globalThis.fetch': 'fetchPolyfill',
            'window.fetch': 'fetchPolyfill',
            'self.fetch': 'fetchPolyfill'
        })
    ],

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
                test: /\.(png|svg|jpg|jpeg|gif|txt|pac|mp3|wav|ogg|ttf)$/i,
                type: 'asset/inline',
            },
            {
                test: /\.atlas$/,
                type: 'asset/inline',
                generator: {
                    dataUrl: {
                        mimetype: 'text/plain'
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
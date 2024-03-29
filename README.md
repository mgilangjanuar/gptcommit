# gptcommit

gptcommit is a tool to help you commit your changes to a git repository with ChatGPT API.

![demo](https://res.cloudinary.com/mgilangjanuar/image/upload/v1677890519/ezgif.com-video-to-gif_qmvjan.gif)

## Installation

```bash
$ npm i -g gptcommit
```

or, with [Homebrew](https://brew.sh/)

```bash
$ brew tap mgilangjanuar/gptcommit
$ brew install gptcommit
```

## Usage

```bash
$ gptcommit set-token <your OpenAI API token>
```

```bash
$ gptcommit [--files /path/to/file1 /path/to/file2 ...] [--context 'it closes #123 #122']
```
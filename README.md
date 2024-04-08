# crust-scripts

A script helps crust users place orders through a cid list file

## Configuration

### Environment config

We provide a .env.example file as reference which you can use as starting point.

```shell
cp .env.example .env
```

Then go through the file and edit the environment variables.

In order to run crust-scripts you are required to define the following ones:

- SEED

### File list

The script will order all the cid list in the example/cidList.txt file. 
Fill the list of cid you want to order into the file and split it by a newline

## Running

Install dependencies

```shell
npm install
```

Start

```shell
npm start
```





import { expose } from "comlink";
import { decode, encode } from "../vcdiff-wasm/index";

expose({ encode, decode });

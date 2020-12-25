/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  ethers,
  EventFilter,
  Signer,
  BigNumber,
  BigNumberish,
  PopulatedTransaction,
} from "ethers";
import {
  Contract,
  ContractTransaction,
  Overrides,
  CallOverrides,
} from "@ethersproject/contracts";
import { BytesLike } from "@ethersproject/bytes";
import { Listener, Provider } from "@ethersproject/providers";
import { FunctionFragment, EventFragment, Result } from "@ethersproject/abi";

interface BenchmarkDataInterface extends ethers.utils.Interface {
  functions: {
    "addForge(bytes32,address)": FunctionFragment;
    "addMarket(address)": FunctionFragment;
    "allMarketsLength()": FunctionFragment;
    "core()": FunctionFragment;
    "exitFee()": FunctionFragment;
    "getAllMarkets()": FunctionFragment;
    "getBenchmarkYieldTokens(bytes32,address,uint256)": FunctionFragment;
    "getForgeAddress(bytes32)": FunctionFragment;
    "getForgeId(address)": FunctionFragment;
    "getMarket(bytes32,address,address)": FunctionFragment;
    "governance()": FunctionFragment;
    "initialize(address)": FunctionFragment;
    "isValidXYT(address)": FunctionFragment;
    "otTokens(bytes32,address,uint256)": FunctionFragment;
    "removeForge(bytes32)": FunctionFragment;
    "setCore(address)": FunctionFragment;
    "setMarketFees(uint256,uint256)": FunctionFragment;
    "storeMarket(bytes32,address,address,address)": FunctionFragment;
    "storeTokens(bytes32,address,address,address,uint256)": FunctionFragment;
    "swapFee()": FunctionFragment;
    "withdrawEther(uint256,address)": FunctionFragment;
    "withdrawToken(address,uint256,address)": FunctionFragment;
    "xytTokens(bytes32,address,uint256)": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "addForge",
    values: [BytesLike, string]
  ): string;
  encodeFunctionData(functionFragment: "addMarket", values: [string]): string;
  encodeFunctionData(
    functionFragment: "allMarketsLength",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "core", values?: undefined): string;
  encodeFunctionData(functionFragment: "exitFee", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "getAllMarkets",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getBenchmarkYieldTokens",
    values: [BytesLike, string, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "getForgeAddress",
    values: [BytesLike]
  ): string;
  encodeFunctionData(functionFragment: "getForgeId", values: [string]): string;
  encodeFunctionData(
    functionFragment: "getMarket",
    values: [BytesLike, string, string]
  ): string;
  encodeFunctionData(
    functionFragment: "governance",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "initialize", values: [string]): string;
  encodeFunctionData(functionFragment: "isValidXYT", values: [string]): string;
  encodeFunctionData(
    functionFragment: "otTokens",
    values: [BytesLike, string, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "removeForge",
    values: [BytesLike]
  ): string;
  encodeFunctionData(functionFragment: "setCore", values: [string]): string;
  encodeFunctionData(
    functionFragment: "setMarketFees",
    values: [BigNumberish, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "storeMarket",
    values: [BytesLike, string, string, string]
  ): string;
  encodeFunctionData(
    functionFragment: "storeTokens",
    values: [BytesLike, string, string, string, BigNumberish]
  ): string;
  encodeFunctionData(functionFragment: "swapFee", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "withdrawEther",
    values: [BigNumberish, string]
  ): string;
  encodeFunctionData(
    functionFragment: "withdrawToken",
    values: [string, BigNumberish, string]
  ): string;
  encodeFunctionData(
    functionFragment: "xytTokens",
    values: [BytesLike, string, BigNumberish]
  ): string;

  decodeFunctionResult(functionFragment: "addForge", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "addMarket", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "allMarketsLength",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "core", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "exitFee", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "getAllMarkets",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getBenchmarkYieldTokens",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getForgeAddress",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "getForgeId", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "getMarket", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "governance", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "initialize", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "isValidXYT", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "otTokens", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "removeForge",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "setCore", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "setMarketFees",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "storeMarket",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "storeTokens",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "swapFee", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "withdrawEther",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "withdrawToken",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "xytTokens", data: BytesLike): Result;

  events: {
    "CoreSet(address)": EventFragment;
    "EtherWithdraw(uint256,address)": EventFragment;
    "ForgeAdded(bytes32,address)": EventFragment;
    "ForgeRemoved(bytes32,address)": EventFragment;
    "TokenWithdraw(address,uint256,address)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "CoreSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "EtherWithdraw"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "ForgeAdded"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "ForgeRemoved"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "TokenWithdraw"): EventFragment;
}

export class BenchmarkData extends Contract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  on(event: EventFilter | string, listener: Listener): this;
  once(event: EventFilter | string, listener: Listener): this;
  addListener(eventName: EventFilter | string, listener: Listener): this;
  removeAllListeners(eventName: EventFilter | string): this;
  removeListener(eventName: any, listener: Listener): this;

  interface: BenchmarkDataInterface;

  functions: {
    addForge(
      _forgeId: BytesLike,
      _forgeAddress: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    "addForge(bytes32,address)"(
      _forgeId: BytesLike,
      _forgeAddress: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    addMarket(
      _market: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    "addMarket(address)"(
      _market: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    allMarketsLength(overrides?: CallOverrides): Promise<[BigNumber]>;

    "allMarketsLength()"(overrides?: CallOverrides): Promise<[BigNumber]>;

    core(overrides?: CallOverrides): Promise<[string]>;

    "core()"(overrides?: CallOverrides): Promise<[string]>;

    exitFee(overrides?: CallOverrides): Promise<[BigNumber]>;

    "exitFee()"(overrides?: CallOverrides): Promise<[BigNumber]>;

    getAllMarkets(overrides?: CallOverrides): Promise<[string[]]>;

    "getAllMarkets()"(overrides?: CallOverrides): Promise<[string[]]>;

    getBenchmarkYieldTokens(
      _forgeId: BytesLike,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[string, string] & { ot: string; xyt: string }>;

    "getBenchmarkYieldTokens(bytes32,address,uint256)"(
      _forgeId: BytesLike,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[string, string] & { ot: string; xyt: string }>;

    getForgeAddress(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<[string]>;

    "getForgeAddress(bytes32)"(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<[string]>;

    getForgeId(arg0: string, overrides?: CallOverrides): Promise<[string]>;

    "getForgeId(address)"(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<[string]>;

    getMarket(
      arg0: BytesLike,
      arg1: string,
      arg2: string,
      overrides?: CallOverrides
    ): Promise<[string]>;

    "getMarket(bytes32,address,address)"(
      arg0: BytesLike,
      arg1: string,
      arg2: string,
      overrides?: CallOverrides
    ): Promise<[string]>;

    governance(overrides?: CallOverrides): Promise<[string]>;

    "governance()"(overrides?: CallOverrides): Promise<[string]>;

    initialize(
      _core: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    "initialize(address)"(
      _core: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    isValidXYT(_xyt: string, overrides?: CallOverrides): Promise<[boolean]>;

    "isValidXYT(address)"(
      _xyt: string,
      overrides?: CallOverrides
    ): Promise<[boolean]>;

    otTokens(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[string]>;

    "otTokens(bytes32,address,uint256)"(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[string]>;

    removeForge(
      _forgeId: BytesLike,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    "removeForge(bytes32)"(
      _forgeId: BytesLike,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    setCore(_core: string, overrides?: Overrides): Promise<ContractTransaction>;

    "setCore(address)"(
      _core: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    setMarketFees(
      _swapFee: BigNumberish,
      _exitFee: BigNumberish,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    "setMarketFees(uint256,uint256)"(
      _swapFee: BigNumberish,
      _exitFee: BigNumberish,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    storeMarket(
      _forgeId: BytesLike,
      _xyt: string,
      _token: string,
      _market: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    "storeMarket(bytes32,address,address,address)"(
      _forgeId: BytesLike,
      _xyt: string,
      _token: string,
      _market: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    storeTokens(
      _forgeId: BytesLike,
      _ot: string,
      _xyt: string,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    "storeTokens(bytes32,address,address,address,uint256)"(
      _forgeId: BytesLike,
      _ot: string,
      _xyt: string,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    swapFee(overrides?: CallOverrides): Promise<[BigNumber]>;

    "swapFee()"(overrides?: CallOverrides): Promise<[BigNumber]>;

    withdrawEther(
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    "withdrawEther(uint256,address)"(
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    withdrawToken(
      token: string,
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    "withdrawToken(address,uint256,address)"(
      token: string,
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    xytTokens(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[string]>;

    "xytTokens(bytes32,address,uint256)"(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[string]>;
  };

  addForge(
    _forgeId: BytesLike,
    _forgeAddress: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  "addForge(bytes32,address)"(
    _forgeId: BytesLike,
    _forgeAddress: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  addMarket(
    _market: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  "addMarket(address)"(
    _market: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  allMarketsLength(overrides?: CallOverrides): Promise<BigNumber>;

  "allMarketsLength()"(overrides?: CallOverrides): Promise<BigNumber>;

  core(overrides?: CallOverrides): Promise<string>;

  "core()"(overrides?: CallOverrides): Promise<string>;

  exitFee(overrides?: CallOverrides): Promise<BigNumber>;

  "exitFee()"(overrides?: CallOverrides): Promise<BigNumber>;

  getAllMarkets(overrides?: CallOverrides): Promise<string[]>;

  "getAllMarkets()"(overrides?: CallOverrides): Promise<string[]>;

  getBenchmarkYieldTokens(
    _forgeId: BytesLike,
    _underlyingAsset: string,
    _expiry: BigNumberish,
    overrides?: CallOverrides
  ): Promise<[string, string] & { ot: string; xyt: string }>;

  "getBenchmarkYieldTokens(bytes32,address,uint256)"(
    _forgeId: BytesLike,
    _underlyingAsset: string,
    _expiry: BigNumberish,
    overrides?: CallOverrides
  ): Promise<[string, string] & { ot: string; xyt: string }>;

  getForgeAddress(arg0: BytesLike, overrides?: CallOverrides): Promise<string>;

  "getForgeAddress(bytes32)"(
    arg0: BytesLike,
    overrides?: CallOverrides
  ): Promise<string>;

  getForgeId(arg0: string, overrides?: CallOverrides): Promise<string>;

  "getForgeId(address)"(
    arg0: string,
    overrides?: CallOverrides
  ): Promise<string>;

  getMarket(
    arg0: BytesLike,
    arg1: string,
    arg2: string,
    overrides?: CallOverrides
  ): Promise<string>;

  "getMarket(bytes32,address,address)"(
    arg0: BytesLike,
    arg1: string,
    arg2: string,
    overrides?: CallOverrides
  ): Promise<string>;

  governance(overrides?: CallOverrides): Promise<string>;

  "governance()"(overrides?: CallOverrides): Promise<string>;

  initialize(
    _core: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  "initialize(address)"(
    _core: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  isValidXYT(_xyt: string, overrides?: CallOverrides): Promise<boolean>;

  "isValidXYT(address)"(
    _xyt: string,
    overrides?: CallOverrides
  ): Promise<boolean>;

  otTokens(
    arg0: BytesLike,
    arg1: string,
    arg2: BigNumberish,
    overrides?: CallOverrides
  ): Promise<string>;

  "otTokens(bytes32,address,uint256)"(
    arg0: BytesLike,
    arg1: string,
    arg2: BigNumberish,
    overrides?: CallOverrides
  ): Promise<string>;

  removeForge(
    _forgeId: BytesLike,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  "removeForge(bytes32)"(
    _forgeId: BytesLike,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  setCore(_core: string, overrides?: Overrides): Promise<ContractTransaction>;

  "setCore(address)"(
    _core: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  setMarketFees(
    _swapFee: BigNumberish,
    _exitFee: BigNumberish,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  "setMarketFees(uint256,uint256)"(
    _swapFee: BigNumberish,
    _exitFee: BigNumberish,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  storeMarket(
    _forgeId: BytesLike,
    _xyt: string,
    _token: string,
    _market: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  "storeMarket(bytes32,address,address,address)"(
    _forgeId: BytesLike,
    _xyt: string,
    _token: string,
    _market: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  storeTokens(
    _forgeId: BytesLike,
    _ot: string,
    _xyt: string,
    _underlyingAsset: string,
    _expiry: BigNumberish,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  "storeTokens(bytes32,address,address,address,uint256)"(
    _forgeId: BytesLike,
    _ot: string,
    _xyt: string,
    _underlyingAsset: string,
    _expiry: BigNumberish,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  swapFee(overrides?: CallOverrides): Promise<BigNumber>;

  "swapFee()"(overrides?: CallOverrides): Promise<BigNumber>;

  withdrawEther(
    amount: BigNumberish,
    sendTo: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  "withdrawEther(uint256,address)"(
    amount: BigNumberish,
    sendTo: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  withdrawToken(
    token: string,
    amount: BigNumberish,
    sendTo: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  "withdrawToken(address,uint256,address)"(
    token: string,
    amount: BigNumberish,
    sendTo: string,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  xytTokens(
    arg0: BytesLike,
    arg1: string,
    arg2: BigNumberish,
    overrides?: CallOverrides
  ): Promise<string>;

  "xytTokens(bytes32,address,uint256)"(
    arg0: BytesLike,
    arg1: string,
    arg2: BigNumberish,
    overrides?: CallOverrides
  ): Promise<string>;

  callStatic: {
    addForge(
      _forgeId: BytesLike,
      _forgeAddress: string,
      overrides?: CallOverrides
    ): Promise<void>;

    "addForge(bytes32,address)"(
      _forgeId: BytesLike,
      _forgeAddress: string,
      overrides?: CallOverrides
    ): Promise<void>;

    addMarket(_market: string, overrides?: CallOverrides): Promise<void>;

    "addMarket(address)"(
      _market: string,
      overrides?: CallOverrides
    ): Promise<void>;

    allMarketsLength(overrides?: CallOverrides): Promise<BigNumber>;

    "allMarketsLength()"(overrides?: CallOverrides): Promise<BigNumber>;

    core(overrides?: CallOverrides): Promise<string>;

    "core()"(overrides?: CallOverrides): Promise<string>;

    exitFee(overrides?: CallOverrides): Promise<BigNumber>;

    "exitFee()"(overrides?: CallOverrides): Promise<BigNumber>;

    getAllMarkets(overrides?: CallOverrides): Promise<string[]>;

    "getAllMarkets()"(overrides?: CallOverrides): Promise<string[]>;

    getBenchmarkYieldTokens(
      _forgeId: BytesLike,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[string, string] & { ot: string; xyt: string }>;

    "getBenchmarkYieldTokens(bytes32,address,uint256)"(
      _forgeId: BytesLike,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[string, string] & { ot: string; xyt: string }>;

    getForgeAddress(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<string>;

    "getForgeAddress(bytes32)"(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<string>;

    getForgeId(arg0: string, overrides?: CallOverrides): Promise<string>;

    "getForgeId(address)"(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<string>;

    getMarket(
      arg0: BytesLike,
      arg1: string,
      arg2: string,
      overrides?: CallOverrides
    ): Promise<string>;

    "getMarket(bytes32,address,address)"(
      arg0: BytesLike,
      arg1: string,
      arg2: string,
      overrides?: CallOverrides
    ): Promise<string>;

    governance(overrides?: CallOverrides): Promise<string>;

    "governance()"(overrides?: CallOverrides): Promise<string>;

    initialize(_core: string, overrides?: CallOverrides): Promise<void>;

    "initialize(address)"(
      _core: string,
      overrides?: CallOverrides
    ): Promise<void>;

    isValidXYT(_xyt: string, overrides?: CallOverrides): Promise<boolean>;

    "isValidXYT(address)"(
      _xyt: string,
      overrides?: CallOverrides
    ): Promise<boolean>;

    otTokens(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<string>;

    "otTokens(bytes32,address,uint256)"(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<string>;

    removeForge(_forgeId: BytesLike, overrides?: CallOverrides): Promise<void>;

    "removeForge(bytes32)"(
      _forgeId: BytesLike,
      overrides?: CallOverrides
    ): Promise<void>;

    setCore(_core: string, overrides?: CallOverrides): Promise<void>;

    "setCore(address)"(_core: string, overrides?: CallOverrides): Promise<void>;

    setMarketFees(
      _swapFee: BigNumberish,
      _exitFee: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    "setMarketFees(uint256,uint256)"(
      _swapFee: BigNumberish,
      _exitFee: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    storeMarket(
      _forgeId: BytesLike,
      _xyt: string,
      _token: string,
      _market: string,
      overrides?: CallOverrides
    ): Promise<void>;

    "storeMarket(bytes32,address,address,address)"(
      _forgeId: BytesLike,
      _xyt: string,
      _token: string,
      _market: string,
      overrides?: CallOverrides
    ): Promise<void>;

    storeTokens(
      _forgeId: BytesLike,
      _ot: string,
      _xyt: string,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    "storeTokens(bytes32,address,address,address,uint256)"(
      _forgeId: BytesLike,
      _ot: string,
      _xyt: string,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    swapFee(overrides?: CallOverrides): Promise<BigNumber>;

    "swapFee()"(overrides?: CallOverrides): Promise<BigNumber>;

    withdrawEther(
      amount: BigNumberish,
      sendTo: string,
      overrides?: CallOverrides
    ): Promise<void>;

    "withdrawEther(uint256,address)"(
      amount: BigNumberish,
      sendTo: string,
      overrides?: CallOverrides
    ): Promise<void>;

    withdrawToken(
      token: string,
      amount: BigNumberish,
      sendTo: string,
      overrides?: CallOverrides
    ): Promise<void>;

    "withdrawToken(address,uint256,address)"(
      token: string,
      amount: BigNumberish,
      sendTo: string,
      overrides?: CallOverrides
    ): Promise<void>;

    xytTokens(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<string>;

    "xytTokens(bytes32,address,uint256)"(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<string>;
  };

  filters: {
    CoreSet(core: null): EventFilter;

    EtherWithdraw(amount: null, sendTo: null): EventFilter;

    ForgeAdded(
      forgeId: BytesLike | null,
      forgeAddress: string | null
    ): EventFilter;

    ForgeRemoved(
      forgeId: BytesLike | null,
      forgeAddress: string | null
    ): EventFilter;

    TokenWithdraw(token: null, amount: null, sendTo: null): EventFilter;
  };

  estimateGas: {
    addForge(
      _forgeId: BytesLike,
      _forgeAddress: string,
      overrides?: Overrides
    ): Promise<BigNumber>;

    "addForge(bytes32,address)"(
      _forgeId: BytesLike,
      _forgeAddress: string,
      overrides?: Overrides
    ): Promise<BigNumber>;

    addMarket(_market: string, overrides?: Overrides): Promise<BigNumber>;

    "addMarket(address)"(
      _market: string,
      overrides?: Overrides
    ): Promise<BigNumber>;

    allMarketsLength(overrides?: CallOverrides): Promise<BigNumber>;

    "allMarketsLength()"(overrides?: CallOverrides): Promise<BigNumber>;

    core(overrides?: CallOverrides): Promise<BigNumber>;

    "core()"(overrides?: CallOverrides): Promise<BigNumber>;

    exitFee(overrides?: CallOverrides): Promise<BigNumber>;

    "exitFee()"(overrides?: CallOverrides): Promise<BigNumber>;

    getAllMarkets(overrides?: CallOverrides): Promise<BigNumber>;

    "getAllMarkets()"(overrides?: CallOverrides): Promise<BigNumber>;

    getBenchmarkYieldTokens(
      _forgeId: BytesLike,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    "getBenchmarkYieldTokens(bytes32,address,uint256)"(
      _forgeId: BytesLike,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getForgeAddress(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    "getForgeAddress(bytes32)"(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getForgeId(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

    "getForgeId(address)"(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getMarket(
      arg0: BytesLike,
      arg1: string,
      arg2: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    "getMarket(bytes32,address,address)"(
      arg0: BytesLike,
      arg1: string,
      arg2: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    governance(overrides?: CallOverrides): Promise<BigNumber>;

    "governance()"(overrides?: CallOverrides): Promise<BigNumber>;

    initialize(_core: string, overrides?: Overrides): Promise<BigNumber>;

    "initialize(address)"(
      _core: string,
      overrides?: Overrides
    ): Promise<BigNumber>;

    isValidXYT(_xyt: string, overrides?: CallOverrides): Promise<BigNumber>;

    "isValidXYT(address)"(
      _xyt: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    otTokens(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    "otTokens(bytes32,address,uint256)"(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    removeForge(_forgeId: BytesLike, overrides?: Overrides): Promise<BigNumber>;

    "removeForge(bytes32)"(
      _forgeId: BytesLike,
      overrides?: Overrides
    ): Promise<BigNumber>;

    setCore(_core: string, overrides?: Overrides): Promise<BigNumber>;

    "setCore(address)"(
      _core: string,
      overrides?: Overrides
    ): Promise<BigNumber>;

    setMarketFees(
      _swapFee: BigNumberish,
      _exitFee: BigNumberish,
      overrides?: Overrides
    ): Promise<BigNumber>;

    "setMarketFees(uint256,uint256)"(
      _swapFee: BigNumberish,
      _exitFee: BigNumberish,
      overrides?: Overrides
    ): Promise<BigNumber>;

    storeMarket(
      _forgeId: BytesLike,
      _xyt: string,
      _token: string,
      _market: string,
      overrides?: Overrides
    ): Promise<BigNumber>;

    "storeMarket(bytes32,address,address,address)"(
      _forgeId: BytesLike,
      _xyt: string,
      _token: string,
      _market: string,
      overrides?: Overrides
    ): Promise<BigNumber>;

    storeTokens(
      _forgeId: BytesLike,
      _ot: string,
      _xyt: string,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: Overrides
    ): Promise<BigNumber>;

    "storeTokens(bytes32,address,address,address,uint256)"(
      _forgeId: BytesLike,
      _ot: string,
      _xyt: string,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: Overrides
    ): Promise<BigNumber>;

    swapFee(overrides?: CallOverrides): Promise<BigNumber>;

    "swapFee()"(overrides?: CallOverrides): Promise<BigNumber>;

    withdrawEther(
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<BigNumber>;

    "withdrawEther(uint256,address)"(
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<BigNumber>;

    withdrawToken(
      token: string,
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<BigNumber>;

    "withdrawToken(address,uint256,address)"(
      token: string,
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<BigNumber>;

    xytTokens(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    "xytTokens(bytes32,address,uint256)"(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    addForge(
      _forgeId: BytesLike,
      _forgeAddress: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "addForge(bytes32,address)"(
      _forgeId: BytesLike,
      _forgeAddress: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    addMarket(
      _market: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "addMarket(address)"(
      _market: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    allMarketsLength(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    "allMarketsLength()"(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    core(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    "core()"(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    exitFee(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    "exitFee()"(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    getAllMarkets(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    "getAllMarkets()"(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    getBenchmarkYieldTokens(
      _forgeId: BytesLike,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "getBenchmarkYieldTokens(bytes32,address,uint256)"(
      _forgeId: BytesLike,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getForgeAddress(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "getForgeAddress(bytes32)"(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getForgeId(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "getForgeId(address)"(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getMarket(
      arg0: BytesLike,
      arg1: string,
      arg2: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "getMarket(bytes32,address,address)"(
      arg0: BytesLike,
      arg1: string,
      arg2: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    governance(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    "governance()"(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    initialize(
      _core: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "initialize(address)"(
      _core: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    isValidXYT(
      _xyt: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "isValidXYT(address)"(
      _xyt: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    otTokens(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "otTokens(bytes32,address,uint256)"(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    removeForge(
      _forgeId: BytesLike,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "removeForge(bytes32)"(
      _forgeId: BytesLike,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    setCore(
      _core: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "setCore(address)"(
      _core: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    setMarketFees(
      _swapFee: BigNumberish,
      _exitFee: BigNumberish,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "setMarketFees(uint256,uint256)"(
      _swapFee: BigNumberish,
      _exitFee: BigNumberish,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    storeMarket(
      _forgeId: BytesLike,
      _xyt: string,
      _token: string,
      _market: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "storeMarket(bytes32,address,address,address)"(
      _forgeId: BytesLike,
      _xyt: string,
      _token: string,
      _market: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    storeTokens(
      _forgeId: BytesLike,
      _ot: string,
      _xyt: string,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "storeTokens(bytes32,address,address,address,uint256)"(
      _forgeId: BytesLike,
      _ot: string,
      _xyt: string,
      _underlyingAsset: string,
      _expiry: BigNumberish,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    swapFee(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    "swapFee()"(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    withdrawEther(
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "withdrawEther(uint256,address)"(
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    withdrawToken(
      token: string,
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "withdrawToken(address,uint256,address)"(
      token: string,
      amount: BigNumberish,
      sendTo: string,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    xytTokens(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "xytTokens(bytes32,address,uint256)"(
      arg0: BytesLike,
      arg1: string,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}

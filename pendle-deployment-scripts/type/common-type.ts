import { Forge } from '..';

export interface DeployedContractData {
  address: string;
  tx?: string;
  abiType: string;
}

export interface SimpleTokenType {
  address: string;
  symbol: string;
}

export interface DetailedTokenType extends SimpleTokenType {
  decimal: number;
  name: string;
}

export type ContractMap = Record<string, DeployedContractData>;

export type ForgeMap = Record<string, Forge>;

export enum DeployOrFetch {
  DEPLOY,
  FETCH,
  FORCE_DEPLOY,
  VERIFY,
  DEPLOY_NOSAVE,
}

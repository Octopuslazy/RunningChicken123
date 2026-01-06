declare module '@smoud/playable-sdk' {
  export const sdk: {
    init?: (cb?: (width: number, height: number) => void) => void;
    on?: (event: string, cb: (...args: any[]) => void) => void;
    start?: () => void;
    install?: () => void;
    finish?: () => void;
    [k: string]: any;
  };
  export default sdk;
}

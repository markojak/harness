/**
 * Dependency checker - validates external tools are available
 */
export interface DepStatus {
    ok: boolean;
    version?: string;
    install?: string;
}
export interface DepsStatus {
    ripgrep: DepStatus;
    git: DepStatus;
    sqlite: DepStatus;
}
export declare function checkDeps(): Promise<DepsStatus>;
export declare function getDeps(): Promise<DepsStatus>;
export declare function hasRipgrep(): boolean;
export declare function hasRipgrepAsync(): Promise<boolean>;

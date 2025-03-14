//Adopted from on https://github.com/xrip/cachegoose

import { RedisOptions } from 'ioredis';
import { Document, Mongoose } from 'mongoose';

declare module 'recachegoose-ioredis' {

    function cachegoose(mongoose: Mongoose, cacheOptions: RedisOptions): void;

    namespace cachegoose {
        function clearCache(customKey: any, cb?: (err: Error | null) => void): Promise<boolean>;
        function setCache(customKey: string, value: any, ttl?: number, cb?: (err: Error | null) => void): Promise<boolean>;
        function disconnect(cb?: (err: Error | null) => void): Promise<boolean>;
        function connect(cb?: (err: Error | null, result: boolean) => void): Promise<boolean>;
        function isConnected(): boolean;
    }

    export = cachegoose;
}

declare module 'mongoose' {
	// eslint-disable-next-line @typescript-eslint/class-name-casing
	interface DocumentQuery<T, DocType extends Document, QueryHelpers = {}> {
		// not cachegoose related fix, but usefull. thanks to https://github.com/DefinitelyTyped/DefinitelyTyped/issues/34205#issuecomment-621976826
		orFail(err?: Error | (() => Error)): DocumentQuery<NonNullable<T>, DocType, QueryHelpers>;
		cache(ttl: number = 60, customKey: string = ''): this
		cache(customKey: string = ''): this
		cache(ttl: number = 60): this
	}
}

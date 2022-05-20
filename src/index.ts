import Ajv, {JTDSchemaType, JTDParser} from 'ajv/dist/jtd';
import {Request, Response, NextFunction} from 'express';

/*Extending Request namespace to include parsed objects*/
declare global {
  namespace Express {
    export interface Request {
      parsed?: {[key: string]: unknown};
    }
  }
}
/*Typing for more strict compilation errors when implemented incorrectly*/

type SchemaFunction<T> = (req?: Request) => JTDSchemaType<T>;


export interface SchemaWithValue<T> {
  value: T,
  schema: JTDSchemaType<T> | SchemaFunction<T>
}

//Ensures that the value type and schema type have matching parameters
export type Options<T> = {[K in keyof T] : T[K] extends {value: infer U, schema: infer U2}
                                              ? JTDSchemaType<U> extends U2
                                                ? U2 extends JTDSchemaType<U>
                                                  ? SchemaWithValue<U>
                                                  : never
                                                : SchemaFunction<U> extends U2
                                                  ? U2 extends SchemaFunction<U>
                                                    ? SchemaWithValue<U>
                                                    : never
                                                  : never
                                              : never
}

//Needed for type coercion for schema
type CoercedSchemaOption<T> = T extends SchemaWithValue<infer U> ? SchemaWithValue<U> : never;

type UnwrappedValueFromSchema<T> = T extends SchemaFunction<infer U> ? U : never;
/*End Typing*/

interface CachedParser<KeyType, T> {
  requestProperty: KeyType,
  schema: SchemaFunction<T> | JTDParser<T>;
  value: T
}

type CachedParserList<T extends any> = T extends []
                                        ? []
                                        : T extends[infer Head, infer Ts]
                                          ? Head extends CachedParser<infer K, infer U>
                                            ? CachedParser<K,U> extends Head
                                              ? [CachedParser<K, U>, ...CachedParserList<Ts>]
                                              : never
                                            : never
                                          : never;

export class Validator {
  ajv : Ajv;

  constructor(ajvOptions?: {[key: string]: unknown | undefined}) {
    ajvOptions = ajvOptions || {};
    this.ajv = new Ajv(ajvOptions);
    this.validate = this.validate.bind(this);
  }

  validate = <T,>(options: Options<T>) => {
    let k : keyof (typeof options);
    let cachedParsers: any = [];
    for (k in options) {
      const currentOption = options[k];
      const option : CoercedSchemaOption<typeof currentOption> = currentOption;
      const schema = option.schema;
      type ValueType = UnwrappedValueFromSchema<typeof schema>;
      cachedParsers.push({"requestProperty": k,
                         "schema": typeof schema === "function" 
                                          ? schema
                                          : this.ajv.compileParser(schema),
                         value: option.value} as CachedParser<typeof k, ValueType>);
    }
    const cachedParserList : CachedParserList<typeof cachedParsers> = cachedParsers;
    console.error(cachedParserList);
    return (req: Request, _: Response, next: NextFunction) => {
      let parsingErrors : {[key: string]: string} = {};
      for (let {requestProperty, schema, value} of cachedParserList) {
        if (!req[requestProperty as keyof Request]) {
          throw new Error(`Error defining property of the request object, does not exist`);
        }
        let parser : JTDParser<typeof value>;
        const func = () => {};
        if (typeof schema == typeof func) {
          parser = this.ajv.compileParser((schema as SchemaFunction<typeof value>)(req));
        }
        else {
          parser = schema;
        }
        const valid = parser(req[requestProperty as keyof Request]);
        if (!valid) {
          parsingErrors[requestProperty] = parser!.position! + parser!.message!;
        }
        else {
          if (!req.parsed)
            req.parsed = {};
          req.parsed[requestProperty] = valid;
        }
      }
      if (Object.keys(parsingErrors).length !== 0) {
        next (new ParsingError(parsingErrors))
      }
      else {
        next();
      }
    }
  }
}

export class ParsingError extends Error {
  parsingErrors: {[key: string] : string};
  constructor(_parsingErrors: {[key: string]: string}) {
    super();
    this.name = "JTDSchemaParsingError";
    this.parsingErrors = _parsingErrors;
  }
}



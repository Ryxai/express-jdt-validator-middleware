import Ajv, {JTDSchemaType, JTDParser} from 'ajv/dist/jtd';
import {Request, Response, NextFunction} from 'express';
import "source-map-support/register"
/*Extending Request namespace to include parsed objects*/
declare global {
  namespace Express {
    export interface Request {
      parsed?: {[key: string]: unknown};
    }
  }
}
/*Typing for more strict compilation errors when implemented incorrectly*/

/**
 * A function that takes a request and returns a {@link  ajv#JTDSchemaType}.
 * @remarks Intended use if for schemas that may need be changed for a particular route if the request
 * changes in some capacity.
 * @typeParam T - The type the schema describes
 * @param request - A {@link express#Request} from an inbound call
 * @returns A {@link Ajv#JTDSchemaType} with a schema of type T
 * @public
 **/
export type SchemaFunction<T> = (req?: Request) => JTDSchemaType<T>;


/**
 * An interface combining a schema and a value of the type described by the schema.
 * @typeParam T - A type to be validated
 **/
export interface SchemaWithValue<T> {
  /**
   * A value to be parsed
   */
  value: T,
  /**
   * Either a {@link ajv#JTDSchemaType} schema for T or a {@link SchemaFunction} function that returns a
   * schema when given an {@link express#Request}
   */
  schema: JTDSchemaType<T> | SchemaFunction<T>
}

//Ensures that the value type and schema type have matching parameters
/**
 * A type used to ensure that the schema and value types match. If the structures do not match a compilation error
 * results.
 * @remarks Since we can parse multiple items (request body, headers etc) this structure is used to ensure they match
 * @typeParam T - A dictionary of {@link SchemaWithValue} whose properties are the names of {@link express#Request}
 * properties to be parsed
 * @typeParam K - The keyname of a parameter of T (body etc)
 * @typeParam U - The type of the value
 * @typeParam U2 - The type of the schema
 */
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
/**
 * Used to force the typing system to force an element of an {@link Options} to be a {@link SchemaWithValue}
 * @typeParam T - The type of the element of an {@link Options}
 * @remarks As stated by its name this is explicitly used for type coercion
 */
type CoercedSchemaOption<T> = T extends SchemaWithValue<infer U> ? SchemaWithValue<U> : never;

/**
 * Used to extract the type of a schema from a {@link SchemaFunction}
 * @typeParam T - A {@link SchemaFunction}, the generic is required for coercion
 * @typeParam U - The type to compare against the schema
 * @Remarks Ued to unwrap the value type from a {@link SchemaFunction}
 */
type UnwrappedValueFromSchema<T> = T extends SchemaFunction<infer U> ? U : never;
/*End Typing*/

/**
 *  A cached parser for a given {@link express#Request} propeerty
 *  @typeParam KeyType - The element of the {@link express#Request} property to be parsed
 *  @typeParam T - The type of the value to be parsed
 */
interface CachedParser<KeyType, T> {
  /**
   * The name of the property to be parsed
   */
  requestProperty: KeyType,
  /**
   * A boolean representing whether or not {@link CachedParser.schema} is a {@link SchemaFunction} or a {@link ajv#JTDSchemaType}
   * @remarks This is used to determine when compiling the parser
   */
  isFunctionSchema: boolean,
  /**
   * The schema to be compiled into a parser
   */
  schema: SchemaFunction<T> | JTDParser<T>;
  /**
   * A value of the schema type to be parsed
   */
  value: T
}

/**
 * A type agnostic list of cached parsers that can have different types
 * @typeParam T - A list of cached parsers
 * @typeParam Head - The type of the cached parser at the head of the list
 * @typeParam Tail - A type incorporating the rest of the cached parsers
 * @typeParam K - The keytype of the cached parser at the head of the list
 * @typeParam U - THe type of the value of the cached parser at the head of the list
 */
type CachedParserList<T extends any> = T extends []
                                        ? []
                                        : T extends[infer Head, infer Ts]
                                          ? Head extends CachedParser<infer K, infer U>
                                            ? CachedParser<K,U> extends Head
                                              ? [CachedParser<K, U>, ...CachedParserList<Ts>]
                                              : never
                                            : never
                                          : never;

/**
 * A validator class used to compile and call parsers for a given {@link express#Route}
 */
export class Validator {
  /**
   * An internal copy of ajv used to compile parsers
   */
  ajv : Ajv;
  isPreparsed: boolean;
  /**
   * Build the validator with the given ajv options as defined in [@link https://ajv.js.org/options.html}
   * @remarks Binds the validate function after implementation so that it can be called directly (it replaces the class)
   * @param ajvOptions
   */
  constructor(ajvOptions?: {[key: string]: unknown | undefined}, _isPreParsed?: boolean) {

    ajvOptions = ajvOptions || {};
    this.ajv = new Ajv(ajvOptions);
    this.isPreparsed = _isPreParsed || false;
    this.validate = this.validate.bind(this);
  }

  /**
   * Validates a {@link express#Request} against a {@link Options} dictionary of {@link ajv#JTDSchemaType} schemas
   * @param options - The {@link Options} dictionary of {@link ajv#JTDSchemaType} schemas
   */
  validate = <T,>(options: Options<T>) => {
    //Getting the keys of the dictionary and constructing the list of cached parsers
    let k : keyof (typeof options);
    let cachedParsers: any = [];
    //Cycling through the keys of parser dictionary
    for (k in options) {
      //Getting all of the contents of the option
      const currentOption = options[k];
      const option : CoercedSchemaOption<typeof currentOption> = currentOption;
      const schema = option.schema;
      type ValueType = UnwrappedValueFromSchema<typeof schema>;
      //Building a cached parser, compiling it if its a schema, if its a function, waiting for the request to compile it
      cachedParsers.push({"requestProperty": k,
                          "isFunctionSchema": typeof schema === "function",
                          "schema": typeof schema === "function"
                                          ? schema
                                          : this.ajv.compileParser(schema as JTDSchemaType<ValueType>),
                          "value": option.value} as CachedParser<typeof k, ValueType>);
    }
    //Explcitly typing the cached parsers
    const cachedParserList : CachedParserList<typeof cachedParsers> = cachedParsers;
    //Building a validation middleware function using the cached parsers
    return (req: Request, _: Response, next: NextFunction) => {
      //Creating a list of parsing errors
      let parsingErrors : {[key: string]: string} = {};
      //Cycling through thr request property names
      for (let {requestProperty, isFunctionSchema, schema, value} of cachedParserList) {
        try {
          //Required to appease the typescript compiler, throws an error if the property is not defined
          if (!req[requestProperty as keyof Request]) {
            throw TypeError(`Error defining property ${requestProperty} for the request object, does not exist`);
          }
          //Getting the schema, getting the results of the dynamic schema from the reuqest if its a function
          let parser : JTDParser<typeof value>;
          if (isFunctionSchema) {
            const retrievedSchema = (schema as SchemaFunction<typeof value>)(req);
            parser = this.ajv.compileParser(retrievedSchema);
          }
          else {
            parser = schema;
          }
          //Parsing the request property
          //Checking if it has been preparsed
          const reqPropNormalized = this.isPreparsed ? JSON.stringify(req[requestProperty as keyof Request]) : req[requestProperty as keyof Request];
          const valid = parser(reqPropNormalized);
          //If a failure, adding the parsing errors to the list of errprs
          if (!valid) {
            parsingErrors[requestProperty] = parser!.position! + parser!.message!;
          }
          //If a success, adding the value to the request.parsed object
          else {
            //If the request.parsed undefined creating it
            if (!req.parsed)
              req.parsed = {};
            req.parsed[requestProperty] = valid;
          }
        }
        //Catching the above type error thrown by not having a property adding it to the parsing errors
        //Otherwise rethrowing the error
        catch (e: any) {
          if (e instanceof TypeError)
            parsingErrors[requestProperty] = e.message;
          else
            throw e;
        }
      }
      //Comopiling the parsing errors into a single parse error object and passing them to the next middleware/route
      //function
      if (Object.keys(parsingErrors).length !== 0) {
        next (new ParsingError(parsingErrors))
      }
      //If no parsing errors, passing the request to the next middleware/route function
      else {
        next();
      }
    }
  }
}

/**
 * An error explictly thrown when parsing fails
 */
export class ParsingError extends Error {
  /**
   * The parsing errors resulting from parsing with {@link ajv#JTDSchemaType#parse}
   */
  parsingErrors: {[key: string] : string};

  /**
   * Builds a parsing error with the given parsing errors
   * @param _parsingErrors - Parsing errors {@link ParsingError#parsingErrors}
   */
  constructor(_parsingErrors: {[key: string]: string}) {
    super();
    this.name = "JTDSchemaParsingError";
    this.parsingErrors = _parsingErrors;
  }
}



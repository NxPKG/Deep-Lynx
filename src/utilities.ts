import {Errors, ValidationError} from "io-ts";
import Result from "./result";

// This is a collection of functions that have proved useful across the application.
export function onDecodeError(resolve:((check: any) => void) ): ((e: Errors ) => void) {
    return ((e: ValidationError[]) => {
        const errorStrings: string[] = []
        for(const error of e) {
            const last = error.context[error.context.length - 1]

            errorStrings.push(`Invalid Value '${error.value}' supplied for field '${last.key}'`)
        }

        resolve(Result.Failure(errorStrings.join(",")))
    })
}

export function getNestedValue(key:string, payload: {[key:string]: any}): any {
    if(key.split(".").length > 1) {
        const keys = key.split(".")
        const parent = keys.shift()

        return getNestedValue(keys.join("."), payload[parent!])
    }

    return payload[key]
}

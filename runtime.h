#include <malloc.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#include "gc.h"

/*
    alias the GCs malloc function to allow for easily
    switching between GCs and trying different ones.
*/
static tgc_t gc;
static inline void* linx_malloc(size_t size) { return tgc_alloc(&gc, size); }

void string_concat(char** old, const char* to_add) {
    size_t old_length = strlen(*old) + 1;
    char* old_copy = linx_malloc(old_length);
    strcpy(old_copy, *old);

    *old = linx_malloc(old_length + strlen(to_add) + 1);
    strcpy(*old, old_copy);
    free(old_copy);
    strcat(*old, to_add);
}

char* double_to_charptr(double num) {
    int length = snprintf(NULL, 0, "%g", num);
    char* str = linx_malloc(length + 1);
    snprintf(str, length + 1, "%g", num);
    return str;
}

typedef enum {
    TYPE_NIL,
    TYPE_BOOLEAN,
    TYPE_NUMBER,
    TYPE_STRING,
    TYPE_LIST,
    TYPE_OBJECT,
    TYPE_FUNCTION
} Type;

typedef struct {
    Type type;
    void* raw;
} Value;

// list
typedef struct {
    size_t capacity;
    size_t length;
    Value** arr;
} List;

// object
typedef struct {
    List* keys;
    List* values;
} Object;

// functions
typedef Value* (*fnptr)(Value**, Value**);

typedef struct {
    fnptr call;
    Value** environment;
    size_t environment_length;
} Function;

void Value__copy(Value** lhs, Value* rhs) {
    free(*lhs);

    *lhs = linx_malloc(sizeof(Value));
    (*lhs)->type = rhs->type;

    switch (rhs->type) {
        case TYPE_NIL: {
            (*lhs)->raw = NULL;
            break;
        }
        case TYPE_BOOLEAN: {
            (*lhs)->raw = linx_malloc(sizeof(bool));
            *(bool*)(*lhs)->raw = *(bool*)rhs->raw;
            break;
        }
        case TYPE_NUMBER: {
            (*lhs)->raw = linx_malloc(sizeof(double));
            *(double*)(*lhs)->raw = *(double*)rhs->raw;
            break;
        }
        case TYPE_STRING: {
            (*lhs)->raw = linx_malloc(sizeof(char*));
            *(char**)(*lhs)->raw = linx_malloc(strlen(*(char**)rhs->raw) + 1);
            strcpy(*(char**)(*lhs)->raw, *(char**)rhs->raw);
            break;
        }
        case TYPE_LIST: {
            (*lhs)->raw = linx_malloc(sizeof(List));
            ((List*)(*lhs)->raw)->capacity = ((List*)rhs->raw)->capacity;
            ((List*)(*lhs)->raw)->length = ((List*)rhs->raw)->length;

            ((List*)(*lhs)->raw)->arr =
                linx_malloc(sizeof(Value*) * ((List*)rhs->raw)->length);

            for (size_t i = 0; i < ((List*)rhs->raw)->length; i++) {
                Value__copy(&((List*)(*lhs)->raw)->arr[i],
                            ((List*)rhs->raw)->arr[i]);
            }

            break;
        }
        case TYPE_OBJECT: {
            (*lhs)->raw = linx_malloc(sizeof(Object));
            ((Object*)(*lhs)->raw)->keys = linx_malloc(sizeof(List));
            ((Object*)(*lhs)->raw)->values = linx_malloc(sizeof(List));

            ((Object*)(*lhs)->raw)->keys->capacity =
                ((Object*)rhs->raw)->keys->capacity;
            ((Object*)(*lhs)->raw)->values->capacity =
                ((Object*)rhs->raw)->values->capacity;
            ((Object*)(*lhs)->raw)->keys->length =
                ((Object*)rhs->raw)->keys->length;
            ((Object*)(*lhs)->raw)->values->length =
                ((Object*)rhs->raw)->values->length;

            ((Object*)(*lhs)->raw)->keys->arr = linx_malloc(
                sizeof(Value*) * ((Object*)(*lhs)->raw)->keys->length);
            ((Object*)(*lhs)->raw)->values->arr = linx_malloc(
                sizeof(Value*) * ((Object*)(*lhs)->raw)->values->length);

            for (size_t i = 0; i < ((Object*)rhs->raw)->keys->length; i++) {
                Value__copy(&((Object*)(*lhs)->raw)->keys->arr[i],
                            ((Object*)rhs->raw)->keys->arr[i]);
                Value__copy(&((Object*)(*lhs)->raw)->values->arr[i],
                            ((Object*)rhs->raw)->values->arr[i]);
            }

            break;
        }
        case TYPE_FUNCTION: {
            (*lhs)->raw = linx_malloc(sizeof(Function));
            ((Function*)(*lhs)->raw)->call = ((Function*)rhs->raw)->call;
            ((Function*)(*lhs)->raw)->environment = linx_malloc(
                sizeof(Value*) * ((Function*)rhs->raw)->environment_length);

            for (size_t i = 0; i < ((Function*)rhs->raw)->environment_length;
                 i++) {
                ((Function*)(*lhs)->raw)->environment[i] =
                    ((Function*)rhs->raw)->environment[i];
            }

            break;
        }
    }
}

Value* Value__create_nil() {
    Value* result = linx_malloc(sizeof(Value));
    result->type = TYPE_NIL;
    result->raw = NULL;
    return result;
}

Value* Value__from_value(Value* value) {
    Value* result = Value__create_nil();
    Value__copy(&result, value);
    return result;
}

bool Value__equals(Value* lhs, Value* rhs) {
    if (lhs->type != rhs->type) return false;

    switch (lhs->type) {
        case TYPE_NIL: {
            // nil is always equal to nil
            return true;
        }
        case TYPE_BOOLEAN: {
            return *(bool*)lhs->raw == *(bool*)rhs->raw;
        }
        case TYPE_NUMBER: {
            return *(double*)lhs->raw == *(double*)rhs->raw;
        }
        case TYPE_STRING: {
            return strcmp(*(char**)lhs->raw, *(char**)rhs->raw) == 0;
        }
        case TYPE_LIST: {
            if (((List*)lhs->raw)->length != ((List*)rhs->raw)->length)
                return false;

            for (size_t i = 0; i < ((List*)lhs->raw)->length; i++) {
                if (!Value__equals(((List*)lhs->raw)->arr[i],
                                   ((List*)rhs->raw)->arr[i])) {
                    return false;
                }
            }

            return true;
        }
        case TYPE_OBJECT: {
            // TODO: check for deep equality
            return false;
        }
        case TYPE_FUNCTION: {
            // functions are only equal if they reference the same object
            return (Function*)lhs->raw == (Function*)rhs->raw;
        }
    }
}

List* List__create() {
    List* result = linx_malloc(sizeof(List));
    result->capacity = 8;
    result->length = 0;
    result->arr = linx_malloc(8 * sizeof(Value));
    return result;
}

void List__grow(List* list) {
    // if capacity is not enough for one more element
    if (list->capacity < list->length + 1) {
        size_t old_capacity = list->capacity;
        Value** old_arr = list->arr;

        list->capacity *= 2;
        list->arr = linx_malloc(list->capacity * sizeof(Value*));
        memcpy(list->arr, old_arr, sizeof(Value*) * old_capacity);
    }
}

void List__append(List* list, Value* value) {
    List__grow(list);
    list->length++;
    Value__copy(&list->arr[list->length - 1], value);
}

Value* Function__call(Function* fn, Value** arguments) {
    return fn->call(fn->environment, arguments);
}

Function* Function__create(fnptr fn, Value** environment,
                           size_t environment_length) {
    Function* result = linx_malloc(sizeof(Function));
    result->call = fn;

    if (environment_length > 0) {
        result->environment = linx_malloc(sizeof(Value*) * environment_length);
        memcpy(result->environment, environment,
               sizeof(Value*) * environment_length);
        result->environment_length = environment_length;
    } else {
        result->environment = NULL;
    }

    return result;
}

Value* Value__from_bool(bool value) {
    Value* result = linx_malloc(sizeof(Value));
    result->type = TYPE_BOOLEAN;
    result->raw = linx_malloc(sizeof(bool));
    *(bool*)result->raw = value;
    return result;
}

Value* Value__from_double(double value) {
    Value* result = linx_malloc(sizeof(Value));
    result->type = TYPE_NUMBER;
    result->raw = linx_malloc(sizeof(double));
    *(double*)result->raw = value;
    return result;
}

Value* Value__from_charptr(const char* str) {
    Value* result = linx_malloc(sizeof(Value));
    result->type = TYPE_STRING;
    result->raw = linx_malloc(sizeof(char**));
    *(char**)result->raw = linx_malloc(strlen(str) + 1);
    strcpy(*(char**)result->raw, str);
    return result;
}

Value* Value__create_list() {
    Value* result = linx_malloc(sizeof(Value));
    result->type = TYPE_LIST;
    result->raw = List__create();
    return result;
}

Value* Value__from_array(Value* arr[], size_t count) {
    Value* result = linx_malloc(sizeof(Value));
    result->type = TYPE_LIST;
    result->raw = linx_malloc(sizeof(List));

    if (count == 0) {
        result->raw = List__create();
    } else {
        ((List*)result->raw)->arr = linx_malloc(count * sizeof(Value*));
        ((List*)result->raw)->length = count;
        ((List*)result->raw)->capacity = count;
        memcpy(((List*)result->raw)->arr, arr, sizeof(Value*) * count);
    }

    return result;
}

Value* Value__create_fn(fnptr fn, Value** environment,
                        size_t environment_length) {
    Value* result = Value__create_nil();
    result->type = TYPE_FUNCTION;
    result->raw = Function__create(fn, environment, environment_length);
    return result;
}

Object* Object__create() {
    Object* result = linx_malloc(sizeof(Object));
    result->keys = List__create();
    result->values = List__create();
    return result;
}

Value* Value__create_object() {
    Value* result = linx_malloc(sizeof(Value));
    result->type = TYPE_OBJECT;
    result->raw = Object__create();
    return result;
}

Value* Object__get(Object* object, Value* key) {
    for (size_t i = 0; i < object->keys->length; i++) {
        if (Value__equals(object->keys->arr[i], key)) {
            return object->values->arr[i];
        }
    }

    // returns `nil` if key doesn't exist
    Value* result = Value__create_nil();
    return result;
}

void Object__set(Object* object, Value* key, Value* value) {
    Value* existing = Object__get(object, key);

    // if the object doesn't have the key, the key has to be added
    if (existing->type == TYPE_NIL) {
        List__append(object->keys, key);
        List__append(object->values, value);
    } else {
        // otherwise update the key
        Value__copy(&existing, value);
    }
}

Value* Value__create_object_from_arrs(Value** keys, Value** values,
                                      size_t size) {
    Value* result = linx_malloc(sizeof(Value));
    result->type = TYPE_OBJECT;
    result->raw = Object__create();

    for (size_t i = 0; i < size; i++) {
        Object__set((Object*)result->raw, keys[i], values[i]);
    }

    return result;
}

char* Value__to_charptr(Value* value) {
    switch (value->type) {
        case TYPE_NIL:
            return "nil";
        case TYPE_BOOLEAN:
            return *(bool*)value->raw ? "true" : "false";
        case TYPE_NUMBER:
            return double_to_charptr(*(double*)value->raw);
        case TYPE_STRING:
            return *(char**)value->raw;
        case TYPE_LIST: {
            char* result = "[";
            List* list = (List*)value->raw;
            for (size_t i = 0; i < list->length; i++) {
                string_concat(&result, Value__to_charptr(list->arr[i]));
                if (i != list->length - 1) string_concat(&result, ", ");
            }
            string_concat(&result, "]");
            return result;
        }
        case TYPE_OBJECT: {
            char* result = "{";
            List* keys = ((Object*)value->raw)->keys;
            List* values = ((Object*)value->raw)->values;

            for (size_t i = 0; i < keys->length; i++) {
                string_concat(&result, Value__to_charptr(keys->arr[i]));
                string_concat(&result, ": ");
                string_concat(&result, Value__to_charptr(values->arr[i]));
                if (i != keys->length - 1) string_concat(&result, ", ");
            }
            string_concat(&result, "}");

            return result;
        }
        case TYPE_FUNCTION:
            return "<function>";
    }
}

bool Value__to_bool(Value* value) {
    // this is where we determine whether values are "falsy" or "truthy"
    switch (value->type) {
        case TYPE_NIL:
            return false;
        case TYPE_BOOLEAN:
            return *(bool*)value->raw;
        case TYPE_NUMBER:
            return *(double*)value->raw != 0;
        case TYPE_STRING:
            return strlen(*(char**)value->raw) != 0;
        case TYPE_LIST:
            return ((List*)value->raw)->length != 0;
        case TYPE_OBJECT:
            return ((Object*)value->raw)->keys->length != 0;
        case TYPE_FUNCTION:
            return true;  // functions are always truthy
    }
}

void print(Value* value) { printf("%s\n", Value__to_charptr(value)); }

/*
    *-----------------*
    |    Operators    |
    *-----------------*
*/

/* <-- Logical --> */

// lhs && rhs
Value* linx__operator_or(Value* lhs, Value* rhs) {
    return Value__from_bool(Value__to_bool(lhs) || Value__to_bool(rhs));
}
// lhs || rhs
Value* linx__operator_and(Value* lhs, Value* rhs) {
    return Value__from_bool(Value__to_bool(lhs) && Value__to_bool(rhs));
}
// !value
Value* linx__operator_not(Value* value) {
    return Value__from_bool(!Value__to_bool(value));
}

/* <-- Comparisons --> */

// lhs == rhs
Value* linx__operator_equals(Value* lhs, Value* rhs) {
    return Value__from_bool(Value__equals(lhs, rhs));
}
// lhs != rhs
Value* linx__operator_nequals(Value* lhs, Value* rhs) {
    return Value__from_bool(!Value__equals(lhs, rhs));
}
// lhs < rhs
Value* linx__operator_lesser(Value* lhs, Value* rhs) {
    bool result = false;
    /*
        is `[1, 2, 3] < 45`?

        might revisit this, but for comparisons between values
        of different types the result is always false
    */
    if (lhs->type != rhs->type) return Value__from_bool(false);

    switch (lhs->type) {
        case TYPE_NIL:
            result = false;
            break;
        case TYPE_BOOLEAN:
            // false is less than true
            result = *(bool*)lhs->raw < *(bool*)rhs->raw;
            break;
        case TYPE_NUMBER:
            result = *(double*)lhs->raw < *(double*)rhs->raw;
            break;
        case TYPE_STRING:
            result = *(char**)lhs->raw < *(char**)rhs->raw;
            break;
        case TYPE_LIST:
            result = ((List*)lhs->raw)->length < ((List*)rhs->raw)->length;
            break;
        case TYPE_OBJECT:
            result = ((Object*)lhs->raw)->keys->length <
                     ((Object*)rhs->raw)->keys->length;
            break;
        case TYPE_FUNCTION:
            result = false;
            break;
    }

    return Value__from_bool(result);
}
// lhs > rhs
Value* linx__operator_greater(Value* lhs, Value* rhs) {
    bool result = false;
    if (lhs->type != rhs->type) return Value__from_bool(result);

    switch (lhs->type) {
        case TYPE_NIL:
            result = false;
            break;
        case TYPE_BOOLEAN:
        case TYPE_NUMBER:
        case TYPE_STRING:
        case TYPE_LIST:
        case TYPE_OBJECT:
            result = !(Value__to_bool(linx__operator_lesser(lhs, rhs)));
            break;
        case TYPE_FUNCTION:
            result = false;
            break;
    }

    return Value__from_bool(result);
}
// lhs <= rhs
Value* linx__operator_lequals(Value* lhs, Value* rhs) {
    return linx__operator_or(linx__operator_lesser(lhs, rhs),
                             linx__operator_equals(lhs, rhs));
}
// lhs >= rhs
Value* linx__operator_gequals(Value* lhs, Value* rhs) {
    return linx__operator_or(linx__operator_greater(lhs, rhs),
                             linx__operator_equals(lhs, rhs));
}

/* <-- Arithmetic --> */

// lhs + rhs
Value* linx__operator_add(Value* lhs, Value* rhs) {
    if (lhs->type == TYPE_STRING || rhs->type == TYPE_STRING) {
        // implicitly convert to string when dealing with addition to strings
        Value* result = Value__from_charptr("");
        string_concat((char**)result->raw, Value__to_charptr(lhs));
        string_concat((char**)result->raw, Value__to_charptr(rhs));
        return result;
    } else if (lhs->type == TYPE_NUMBER && rhs->type == TYPE_NUMBER) {
        Value* result =
            Value__from_double(*(double*)lhs->raw + *(double*)rhs->raw);
        return result;
    } else {
        return Value__create_nil();
    }
}
// lhs - rhs
Value* linx__operator_subtract(Value* lhs, Value* rhs) {
    if (lhs->type == TYPE_NUMBER && rhs->type == TYPE_NUMBER) {
        Value* result =
            Value__from_double(*(double*)lhs->raw - *(double*)rhs->raw);
        return result;
    } else {
        return Value__create_nil();
    }
}
// lhs * rhs
Value* linx__operator_multiply(Value* lhs, Value* rhs) {
    if (lhs->type == TYPE_NUMBER && rhs->type == TYPE_NUMBER) {
        Value* result =
            Value__from_double(*(double*)lhs->raw * *(double*)rhs->raw);
        return result;
    } else if (lhs->type == TYPE_STRING && rhs->type == TYPE_NUMBER &&
               *(double*)rhs->raw > 0) {
        char* result = "";
        for (size_t i = 0; i < (size_t)(*(double*)rhs->raw); i++) {
            string_concat(&result, result);
        }
        return Value__from_charptr(result);
    } else {
        return Value__create_nil();
    }
}
// lhs / rhs
Value* linx__operator_divide(Value* lhs, Value* rhs) {
    if (lhs->type == TYPE_NUMBER && rhs->type == TYPE_NUMBER) {
        Value* result =
            Value__from_double(*(double*)lhs->raw / *(double*)rhs->raw);
        return result;
    } else {
        return Value__create_nil();
    }
}
// lhs % rhs
Value* linx__operator_mod(Value* lhs, Value* rhs) {
    if (lhs->type == TYPE_NUMBER && rhs->type == TYPE_NUMBER) {
        Value* result = Value__from_double(*(int*)lhs->raw % *(int*)rhs->raw);
        return result;
    } else {
        return Value__create_nil();
    }
}

/* <-- Other --> */

// lhs = rhs
Value* linx__operator_assign(Value* lhs, Value* rhs) {
    Value__copy(&lhs, rhs);
    return lhs;
}

// obj.key
Value* linx__operator_dot(Value* obj, Value* key) {
    if (obj->type != TYPE_OBJECT) return Value__create_nil();
    return Object__get((Object*)obj->raw, key);
}

// arr[idx]
Value* linx__operator_subscript(Value* arr, Value* idx) {
    if (arr->type != TYPE_OBJECT && arr->type != TYPE_LIST) {
        return Value__create_nil();
    }

    if (arr->type == TYPE_OBJECT) {
        if (idx->type != TYPE_STRING) return Value__create_nil();
        return linx__operator_dot(arr, idx);
    } else {
        if (idx->type != TYPE_NUMBER) return Value__create_nil();

        // dealing with a list & a number idx
        double index = *(double*)idx->raw;

        // TODO: circular indexing would be nice
        if (index < 0 || index > ((List*)arr->raw)->length - 1 ||
            (int)index != index) {
            return Value__create_nil();
        }

        return ((List*)arr->raw)->arr[(int)(*(double*)idx->raw)];
    }
}

/* func(...args) */
Value* linx__operator_call(Value* func, Value** args) {
    if (func->type == TYPE_FUNCTION) {
        return Function__call((Function*)func->raw, args);
    }

    return Value__create_nil();
}

char* type_to_string(Type t) {
    switch (t) {
        case TYPE_NIL:
            return "nil";
        case TYPE_BOOLEAN:
            return "boolean";
        case TYPE_NUMBER:
            return "number";
        case TYPE_STRING:
            return "string";
        case TYPE_LIST:
            return "list";
        case TYPE_OBJECT:
            return "object";
        case TYPE_FUNCTION:
            return "function";
    }
}

Value* len__builtin_def(Value** environment, Value** arguments) {
    switch (arguments[0]->type) {
        case TYPE_NIL:
        case TYPE_BOOLEAN:
        case TYPE_NUMBER:
        case TYPE_FUNCTION:
            return Value__create_nil();
        case TYPE_STRING:
            return Value__from_double(strlen(*(char**)arguments[0]->raw));
        case TYPE_LIST:
            return Value__from_double(((List*)arguments[0]->raw)->length);
        case TYPE_OBJECT:
            return Value__from_double(
                ((Object*)arguments[0]->raw)->keys->length);
    }
}

Value* type__builtin_def(Value** environment, Value** arguments) {
    return Value__from_charptr(type_to_string(arguments[0]->type));
}

Value* range__builtin_def(Value** environment, Value** arguments) {
    Value* start = arguments[0];
    Value* end = arguments[1];
    Value* step = arguments[2];

    if (Value__equals(start, end)) {
        return Value__create_list();
    }

    bool forwards = true;
    if (Value__to_bool(linx__operator_greater(start, end))) forwards = false;

    Value* result = Value__from_array(NULL, 0);

    if (forwards) {
        while (Value__to_bool(linx__operator_lequals(start, end))) {
            List__append((List*)result->raw, start);
            Value__copy(&start, linx__operator_add(start, step));
        }
    } else {
        while (Value__to_bool(linx__operator_gequals(start, end))) {
            List__append((List*)result->raw, start);
            Value__copy(&start, linx__operator_subtract(start, step));
        }
    }

    return result;
}

Value* toString__builtin_def(Value** environment, Value** arguments) {
    return Value__from_charptr(Value__to_charptr(arguments[0]));
}

// Value* print__builtin_def(Value** environment, Value** arguments) {
//     printf("%s\n", Value__to_charptr(arguments[0]));
//     return Value__create_nil();
// }

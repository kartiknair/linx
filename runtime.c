#include <malloc.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

void string_concat(char** old, const char* to_add) {
    size_t old_length = strlen(*old) + 1;
    char* old_copy = malloc(old_length);
    strcpy(old_copy, *old);

    *old = malloc(old_length + strlen(to_add) + 1);
    strcpy(*old, old_copy);
    free(old_copy);
    strcat(*old, to_add);
}

char* double_to_char_buf(double num) {
    int length = snprintf(NULL, 0, "%f", num);
    char* str = malloc(length + 1);
    snprintf(str, length + 1, "%f", num);
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

/*
    how do you represent complex values?
    specifically lists, objects, & first-class functions.

    trying to implement in this order, since it'll be simplest.
*/

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

void Value__copy(Value** lhs, Value* rhs) {
    free(*lhs);

    *lhs = malloc(sizeof(Value));
    (*lhs)->type = rhs->type;

    switch (rhs->type) {
        case TYPE_NIL: {
            (*lhs)->raw = NULL;
            break;
        }
        case TYPE_BOOLEAN: {
            (*lhs)->raw = malloc(sizeof(bool));
            *(bool*)(*lhs)->raw = *(bool*)rhs->raw;
            break;
        }
        case TYPE_NUMBER: {
            (*lhs)->raw = malloc(sizeof(double));
            *(double*)(*lhs)->raw = *(double*)rhs->raw;
            break;
        }
        case TYPE_STRING: {
            (*lhs)->raw = malloc(sizeof(char**));
            *(char**)(*lhs)->raw = malloc(strlen(*(char**)rhs->raw) + 1);
            strcpy(*(char**)(*lhs)->raw, *(char**)rhs->raw);
            break;
        }
    }
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
    }
}

List* List__create() {
    List* result = malloc(sizeof(List));
    result->capacity = 8;
    result->length = 0;
    result->arr = calloc(8, sizeof(Value));
    return result;
}

void List__grow(List* list) {
    // if capacity is not enough for one more element
    if (list->capacity < list->length + 1) {
        size_t old_capacity = list->capacity;
        Value** old_arr = list->arr;

        list->capacity *= 2;
        list->arr = calloc(list->capacity, sizeof(Value*));
        memcpy(list->arr, old_arr, sizeof(Value*) * old_capacity);
    }
}

void List__append(List* list, Value* value) {
    List__grow(list);
    list->length++;
    Value__copy(&list->arr[list->length - 1], value);
}

// functions

// the main thing is that functions need to keep an environment
// environment has to by reference, args are by value (in linx at least)

typedef Value* (*fnptr)(Value**, Value**);

typedef struct {
    fnptr call;
    Value** environment;
    size_t environment_length;
} Function;

Value* Function__call(Function* fn, Value** arguments) {
    return fn->call(fn->environment, arguments);
}

Function* Function__create(fnptr fn, Value** environment,
                           size_t environment_length) {
    Function* result = malloc(sizeof(Function));
    result->call = fn;

    if (environment_length > 0) {
        result->environment = malloc(sizeof(Value*) * environment_length);
        memcpy(result->environment, environment,
               sizeof(Value*) * environment_length);
        result->environment_length = environment_length;
    } else {
        result->environment = NULL;
    }

    return result;
}

Value* Value__create_nil() {
    Value* result = malloc(sizeof(Value));
    result->type = TYPE_NIL;
    result->raw = NULL;
    return result;
}

Value* Value__from_bool(bool value) {
    Value* result = malloc(sizeof(Value));
    result->type = TYPE_BOOLEAN;
    result->raw = malloc(sizeof(bool));
    *(bool*)result->raw = value;
    return result;
};

Value* Value__from_double(double value) {
    Value* result = malloc(sizeof(Value));
    result->type = TYPE_NUMBER;
    result->raw = malloc(sizeof(double));
    *(double*)result->raw = value;
    return result;
};

Value* Value__from_charptr(const char* str) {
    Value* result = malloc(sizeof(Value));
    result->type = TYPE_STRING;
    result->raw = malloc(sizeof(char**));
    *(char**)result->raw = malloc(strlen(str) + 1);
    strcpy(*(char**)result->raw, str);
    return result;
};

Value* Value__create_list() {
    Value* result = malloc(sizeof(Value));
    result->type = TYPE_LIST;
    result->raw = List__create();
    return result;
}

Value* Value__from_array(Value* arr[], size_t count) {
    Value* result = malloc(sizeof(Value));
    result->type = TYPE_LIST;
    result->raw = malloc(sizeof(List));

    List* retlist = (List*)result->raw;
    retlist->arr = calloc(count, sizeof(Value*));
    retlist->length = count;
    retlist->capacity = count;
    memcpy(retlist->arr, arr, sizeof(Value*) * count);

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
    Object* result = malloc(sizeof(Object));
    result->keys = List__create();
    result->values = List__create();
    return result;
}

Value* Value__create_object() {
    Value* result = malloc(sizeof(Value));
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

char* Value__to_charptr(Value* value) {
    switch (value->type) {
        case TYPE_NIL:
            return "nil";
        case TYPE_BOOLEAN:
            return *(bool*)value->raw ? "true" : "false";
        case TYPE_NUMBER:
            return double_to_char_buf(*(double*)value->raw);
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
        case TYPE_OBJECT:
            return "<object>";
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
Value* linx__operator_or(Value* lhs, Value* rhs){};
// lhs || rhs
Value* linx__operator_and(Value* lhs, Value* rhs){};
// !value
Value* linx__operator_not(Value* value){};

/* <-- Comparisons --> */

// lhs == rhs
Value* linx__operator_equals(Value* lhs, Value* rhs) {
    return Value__from_bool(Value__equals(lhs, rhs));
};
// lhs != rhs
Value* linx__operator_nequals(Value* lhs, Value* rhs) {
    return Value__from_bool(!Value__equals(lhs, rhs));
};
// lhs < rhs
Value* linx__operator_lesser(Value* lhs, Value* rhs){};
// lhs > rhs
Value* linx__operator_greater(Value* lhs, Value* rhs){};
// lhs <= rhs
Value* linx__operator_lequals(Value* lhs, Value* rhs){};
// lhs >= rhs
Value* linx__operator_gequals(Value* lhs, Value* rhs){};

/* <-- Arithmetic --> */

// lhs + rhs
Value* linx__operator_add(Value* lhs, Value* rhs) {
    if (lhs->type == TYPE_NUMBER && rhs->type == TYPE_NUMBER) {
        Value* result =
            Value__from_double(*(double*)lhs->raw + *(double*)rhs->raw);
        return result;
    }
}
// lhs - rhs
Value* linx__operator_subtract(Value* lhs, Value* rhs){};
// lhs * rhs
Value* linx__operator_multiply(Value* lhs, Value* rhs){};
// lhs / rhs
Value* linx__operator_divide(Value* lhs, Value* rhs){};
// lhs % rhs
Value* linx__operator_mod(Value* lhs, Value* rhs){};

/* <-- Other --> */

// lhs = rhs
Value* linx__operator_assign(Value* lhs, Value* rhs) {
    Value__copy(&lhs, rhs);
    return lhs;
};

// obj.key
Value* linx__operator_dot(Value* obj, Value* key) {
    if (obj->type != TYPE_OBJECT) return Value__create_nil();
    return Object__get((Object*)obj->raw, key);
};

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
};

/* func(...args) */
Value* linx__operator_call(Value* func, Value** args) {
    if (func->type == TYPE_FUNCTION) {
        return Function__call((Function*)func->raw, args);
    }

    return Value__create_nil();
}

/*

hand-written output for the following linx:

        fn createCounter(initial) {
                let n = initial
                fn counter() {
                        n = n + 1
                        return n
                }
                return counter
        }

        let c1 = createCounter()
        let c2 = createCounter()
        print(c1())
        print(c1())
        print(c2())
        print(c1())

*/

// nested function is lifted to the top level by the compiler
Value* counter_def(Value** environment, Value** arguments) {
    linx__operator_assign(
        environment[0],
        linx__operator_add(environment[0], Value__from_double(1)));
    return environment[0];
}

Value* createCounter_def(Value** environment, Value** arguments) {
    Value* n = arguments[0];
    Value* counter = Value__create_fn(&counter_def, (Value**){&n}, 1);
    return counter;
}

int main(void) {
    Value* createCounter = Value__create_fn(&createCounter_def, NULL, 0);

    Value* c1 =
        linx__operator_call(createCounter, (Value*[]){Value__from_double(12)});
    Value* c2 =
        linx__operator_call(createCounter, (Value*[]){Value__from_double(34)});

    print(linx__operator_call(c1, NULL));
    print(linx__operator_call(c1, NULL));
    print(linx__operator_call(c2, NULL));
    print(linx__operator_call(c2, NULL));

    return 0;
}
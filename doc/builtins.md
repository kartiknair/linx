there are a few built-in functions:

> note: if the type of a value is provided, the return value will be `nil` for any other type of value.

1. `len(something)` returns the length of `something` where something is either a string, list, or object
2. `range(start, end, step)` returns a list of numbers based on the arguments. similar to python's `range`
3. `toString(value)` converts any value to a string form

std library:

### `number`

1. `number.parseInt(str)` parses an integral value from the provided string
1. `number.parseFloat(str)` parses a floating point value from the provided string

### `string`

1. `string.substring(str, start, end)` returns a "sub" string based on the arguments

### `list`

1. `list.map(list, callback)` loops through the list & assigns the result of callback to every element
2. `list.slice(list, start, end)` returns a sub-list of a list
3. `list.contains(list, value)` returns whether or not the value is in the list (`true`/`false`)
4. `list.iterator(list)` returns an iterator for the provided list. see [iterator](#iterator) for more details

### `object`

1. `object.keys(obj)` returns a list of keys that the object contains
2. `object.values(obj)` returns a list of values that the object contains
3. `object.contains(obj, key)` returns whether or not the given key is in the list (`true`/`false`)
4. `object.iterator(obj)` returns an iterator for the provided object. see [iterator](#iterator) for more details

### `math`

1. `math.floor(number)`
2. `math.pow(base, power)`

### `fs`

> note: all paths are expected to be in unix-like format (e.g. './filename.li' or '/home/someFile'). if

1. `fs.readFile(path)`
2. `fs.writeFile(path, content)`
3. `fs.stat(path)`
4. `fs.ensure(path)` recursively creates directories until the provided path exists
5. `fs.exists(path)`

### `iterator`

while an iterator is just a regular object the std library makes sure to ensure that iterators are of the following structure

iterators have two functions that you can call:

1. `iterator.valid()` boolean value letting you know if the iterator is still valid
2. `iterator.next()` returns the next iteration, `nil` if you're not checking for validity

the internal for loop is sugar for a while loop and an iterator. for example:

```rust
let arr = [1, 2, 3, 4]

// this for loop:
for el in arr {
    print(el)
}

// gets transformed into this:
let arr__iterator = list.iterator(arr)
while arr__iterator.valid() {
    let el = arr__iterator.next()
    print(el)
}
```

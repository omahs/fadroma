use std::fmt::Debug;

use fadroma::{
    bin_serde::{
        FadromaSerialize, FadromaDeserialize,
        FadromaSerializeExt, Deserializer
    },
    cosmwasm_std::Uint128
};

#[derive(FadromaSerialize, FadromaDeserialize, PartialEq, Debug)]
struct UnitStruct;

#[derive(FadromaSerialize, FadromaDeserialize, PartialEq, Debug)]
struct EmptyNamedStruct { }

#[derive(FadromaSerialize, FadromaDeserialize, PartialEq, Debug)]
struct NamedStruct {
    a: Uint128,
    b: String
}

#[derive(FadromaSerialize, FadromaDeserialize, PartialEq, Debug)]
struct EmptyTupleStruct();

#[derive(FadromaSerialize, FadromaDeserialize, PartialEq, Debug)]
struct TupleStruct(String, u64);

#[derive(FadromaSerialize, FadromaDeserialize, PartialEq, Debug)]
enum EnumVariants {
    Struct { a: Uint128, b: String },
    Tuple(String, u64),
    Unit
}

pub fn test_serde<T>(item: &T, byte_len: usize)
    where T: FadromaSerialize + FadromaDeserialize + PartialEq + Debug
{
    let bytes = item.serialize().unwrap();
    assert_eq!(bytes.len(), byte_len);

    let mut de = Deserializer::from(bytes);
    let result = de.deserialize::<T>().unwrap();

    assert_eq!(result, *item);
}

#[test]
fn test_struct() {
    test_serde(&UnitStruct, 0);
    test_serde(&EmptyNamedStruct { }, 0);
    test_serde(&NamedStruct { a: Uint128::new(20), b: "ABC".into() }, 6);
    test_serde(&EmptyTupleStruct(), 0);
    test_serde(&TupleStruct("ABC".into(), 20), 6);
}

#[test]
fn test_enum() {
    test_serde(&EnumVariants::Struct { a: Uint128::new(20), b: "ABC".into() }, 7);
    test_serde(&EnumVariants::Tuple("ABC".into(), 20), 7);
    test_serde(&EnumVariants::Unit, 1);
}

use std::collections::HashMap;

use crate::cosmwasm_std::Coin;

use super::{
    EnsembleResult,
    storage::TestStorage,
    bank::Bank,
    response::BankResponse
};

pub(crate) struct State {
    pub stores: HashMap<String, TestStorage>,
    bank: Bank,
    scopes: Vec<Scope>
}

#[derive(Clone, Debug)]
pub enum Op {
    StorageWrite {
        address: String,
        key: Vec<u8>,
        old: Option<Vec<u8>>
    },
    BankAddFunds {
        address: String,
        coin: Coin
    },
    BankRemoveFunds {
        address: String,
        coin: Coin
    },
    BankTransferFunds {
        from: String,
        to: String,
        coin: Coin
    }
}

struct Scope(Vec<Op>);

impl State {
    pub fn new() -> Self {
        Self {
            stores: HashMap::new(),
            bank: Bank::default(),
            scopes: vec![]
        }
    }

    pub fn push_ops(&mut self, ops: Vec<Op>) {
        assert!(self.scopes.len() > 0);
        
        let scope = self.scopes.last_mut().unwrap();
        scope.0.extend(ops);
    }

    #[inline]
    pub fn commit(&mut self) {
        self.scopes.clear();
    }

    #[inline]
    pub fn revert(&mut self) {
        while self.scopes.len() > 0 {
            self.revert_scope();
        }
    }

    #[inline]
    pub fn push_scope(&mut self) {
        self.scopes.push(Scope::new());
    }

    pub fn revert_scope(&mut self) {
        assert!(self.scopes.len() > 0);

        let scope = self.scopes.pop().unwrap();

        for op in scope.0 {
            match op {
                Op::StorageWrite { address, key, old } => {
                    if let Some(storage) = self.stores.get_mut(&address) {
                        if let Some(old) = old {
                            storage.storage.insert(key, old);
                        } else {
                            storage.storage.remove(&key);
                        }
                    }
                },
                Op::BankAddFunds { address, coin } => {
                    self.bank.remove_funds(&address, coin).unwrap();
                },
                Op::BankRemoveFunds { address, coin } => {
                    self.bank.add_funds(&address, coin);
                },
                Op::BankTransferFunds { from, to, coin } => {
                    self.bank.transfer(&to, &from, coin).unwrap();
                }
            }
        }
    }

    pub fn add_funds(
        &mut self,
        address: impl Into<String>, 
        coins: Vec<Coin>
    ) {
        assert!(self.scopes.len() > 0);

        let address: String = address.into();

        let scope = self.scopes.last_mut().unwrap();
        scope.0.reserve_exact(coins.len());

        for coin in coins {
            self.bank.add_funds(&address, coin.clone());

            scope.0.push(Op::BankAddFunds {
                address: address.clone(),
                coin
            });
        }
    }

    pub fn remove_funds(
        &mut self,
        address: impl Into<String>, 
        coins: Vec<Coin>
    ) -> EnsembleResult<()> {
        assert!(self.scopes.len() > 0);

        let address: String = address.into();
        self.push_scope();

        let temp = self.scopes.last_mut().unwrap();
        temp.0.reserve_exact(coins.len());

        for coin in coins {
            match self.bank.remove_funds(&address, coin.clone()) {
                Ok(()) => {
                    temp.0.push(Op::BankRemoveFunds {
                        address: address.clone(),
                        coin
                    });
                },
                Err(err) => {
                    self.revert_scope();

                    return Err(err);
                }
            }
        }

        let temp = self.scopes.pop().unwrap();
        self.current_scope_mut().0.extend(temp.0);

        Ok(())
    }

    pub fn transfer_funds(
        &mut self,
        from: impl Into<String>,
        to: impl Into<String>,
        coins: Vec<Coin>
    ) -> EnsembleResult<BankResponse> {
        assert!(self.scopes.len() > 0);

        let from = from.into();
        let to = to.into();

        let res = BankResponse {
            sender: from.clone(),
            receiver: to.clone(),
            coins: coins.clone()
        };

        self.push_scope();

        let temp = self.scopes.last_mut().unwrap();
        temp.0.reserve_exact(coins.len());

        for coin in coins {
            match self.bank.transfer(&from, &to, coin.clone()) {
                Ok(()) => {
                    temp.0.push(Op::BankTransferFunds {
                        from: from.clone(),
                        to: to.clone(),
                        coin: coin.clone()
                    });
                },
                Err(err) => {
                    self.revert_scope();

                    return Err(err);
                }
            }
        }

        let temp = self.scopes.pop().unwrap();
        self.current_scope_mut().0.extend(temp.0);

        Ok(res)
    }

    #[inline]
    fn current_scope_mut(&mut self) -> &mut Scope {
        assert!(self.scopes.len() > 0);

        self.scopes.last_mut().unwrap()
    }
}

impl Scope {
    fn new() -> Self {
        Scope(vec![])
    }
}

#[cfg(test)]
mod tests {
    use crate::cosmwasm_std::Storage;
    use super::*;

    const CONTRACTS: &[&str] = &["A", "B", "C"];

    #[test]
    fn storage_revert_keeps_initial_value_and_removes_newly_set() {
        let mut state = setup_storage();

        state.push_scope();
        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        store.remove(b"a");
        store.set(b"b", b"yyz");
        store.remove(b"c");

        let ops = store.ops();
        assert_eq!(ops.len(), 2);

        drop(store);

        state.push_ops(ops);
        state.revert();

        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        assert_eq!(store.get(b"a"), Some(b"abc".to_vec()));
        assert_eq!(store.get(b"b"), None);
    }

    #[test]
    fn storage_commit_saves_changes_and_clears_all_scopes() {
        let mut state = setup_storage();

        state.push_scope();
        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        store.remove(b"a");
        store.set(b"b", b"yyz");

        let ops = store.ops();
        drop(store);

        state.push_ops(ops);
        state.commit();

        assert_eq!(state.scopes.len(), 0);

        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        assert_eq!(store.get(b"a"), None);
        assert_eq!(store.get(b"b"), Some(b"yyz".to_vec()));
    }

    #[test]
    fn storage_revert_scope_affects_only_topmost_scope() {
        let mut state = setup_storage();

        state.push_scope();
        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        store.remove(b"a");
        store.set(b"b", b"yyz");

        let ops = store.ops();
        drop(store);

        state.push_ops(ops);

        state.push_scope();
        let store = state.stores.get_mut(CONTRACTS[1]).unwrap();
        store.set(b"a", b"yyz");

        let ops = store.ops();
        drop(store);

        state.push_ops(ops);
        state.revert_scope();

        let store = state.stores.get_mut(CONTRACTS[1]).unwrap();
        assert_eq!(store.get(b"a"), None);

        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        assert_eq!(store.get(b"a"), None);
        assert_eq!(store.get(b"b"), Some(b"yyz".to_vec()));

        state.commit();

        assert_eq!(state.scopes.len(), 0);
    }

    #[test]
    fn reverts_bank_add_remove_funds() {
        let mut state = State::new();
        state.bank.add_funds(CONTRACTS[0], Coin::new(100, "uscrt"));

        state.push_scope();

        state.add_funds(CONTRACTS[0], vec![Coin::new(100, "uscrt")]);
        assert_eq!(state.scopes.last().unwrap().0.len(), 1);

        state.remove_funds(CONTRACTS[1], vec![Coin::new(100, "uscrt")]).unwrap_err();
        assert_eq!(state.scopes.last().unwrap().0.len(), 1);

        assert_eq!(check_balance(&state, CONTRACTS[1]), 0);
        assert_eq!(check_balance(&state, CONTRACTS[0]), 200);

        state.revert();

        assert_eq!(check_balance(&state, CONTRACTS[0]), 100);
    }

    #[test]
    fn reverts_bank_transfers() {
        let mut state = State::new();
        state.bank.add_funds(CONTRACTS[0], Coin::new(100, "uscrt"));

        state.push_scope();
        state.add_funds(CONTRACTS[0], vec![Coin::new(100, "uscrt")]);

        assert_eq!(check_balance(&state, CONTRACTS[0]), 200);

        state.push_scope();
        state.remove_funds(CONTRACTS[0], vec![Coin::new(100, "uscrt")]).unwrap();
        state.transfer_funds(
            CONTRACTS[0],
            CONTRACTS[1],
            vec![
                Coin::new(100, "uscrt"),
                Coin::new(100, "atom")
            ]
        ).unwrap_err();

        assert_eq!(check_balance(&state, CONTRACTS[1]), 0);
        assert_eq!(check_balance(&state, CONTRACTS[0]), 100);

        state.transfer_funds(
            CONTRACTS[0],
            CONTRACTS[1],
            vec![
                Coin::new(100, "uscrt"),
            ]
        ).unwrap();

        assert_eq!(check_balance(&state, CONTRACTS[1]), 100);
        assert_eq!(check_balance(&state, CONTRACTS[0]), 0);

        state.revert();

        assert_eq!(check_balance(&state, CONTRACTS[1]), 0);
        assert_eq!(check_balance(&state, CONTRACTS[0]), 100);
    }

    fn check_balance(state: &State, address: &str) -> u128 {
        let mut balances = state.bank.query_balances(address, Some("uscrt".into()));
        assert_eq!(balances.len(), 1);

        balances.pop().unwrap().amount.u128()
    }

    fn setup_storage() -> State {
        let mut state = State::new();

        let mut storage = TestStorage::new(CONTRACTS[0]);
        storage.storage.insert(b"a".to_vec(), b"abc".to_vec());

        state.stores.insert(CONTRACTS[0].into(), storage);
        state.stores.insert(CONTRACTS[1].into(), TestStorage::new(CONTRACTS[1]));
        state.stores.insert(CONTRACTS[2].into(), TestStorage::new(CONTRACTS[2]));

        state
    }
}
